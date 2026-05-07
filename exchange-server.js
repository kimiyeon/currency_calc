import net from "net";
import { z } from "zod";

const EXCHANGE_RATES = {
  USD: 1,
  KRW: 1320,
  JPY: 148,
  EUR: 0.92,
  GBP: 0.79,
  CNY: 7.24,
  CAD: 1.36,
  AUD: 1.53,
};

function sendResponse(socket, id, result) {
  const resp = { jsonrpc: "2.0", id, result };
  socket.write(JSON.stringify(resp) + "\n");
  console.error("Sent:", JSON.stringify(resp));
}

function sendError(socket, id, code, message) {
  const resp = { jsonrpc: "2.0", id, error: { code, message } };
  socket.write(JSON.stringify(resp) + "\n");
  console.error("Sent error:", JSON.stringify(resp));
}

const server = net.createServer((socket) => {
  console.error("Client connected from", socket.remoteAddress);
  let buffer = "";
  let initialized = false;

  socket.on("data", (data) => {
    buffer += data.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      console.error("Received:", line);

      try {
        const msg = JSON.parse(line);
        const id = msg.id;

        if (msg.method === "initialize") {
          initialized = true;
          sendResponse(socket, id, {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: { name: "exchange-server", version: "1.0.0" },
          });
        } else if (msg.method === "tools/list" && initialized) {
          sendResponse(socket, id, {
            tools: [
              {
                name: "exchange",
                description: "Convert amount from one currency to another",
                inputSchema: {
                  type: "object",
                  properties: {
                    amount: { type: "number", description: "Amount to convert" },
                    from: { type: "string", description: "Source currency (USD, KRW, JPY, etc.)" },
                    to: { type: "string", description: "Target currency (USD, KRW, JPY, etc.)" },
                  },
                  required: ["amount", "from", "to"],
                },
              },
              {
                name: "rates",
                description: "Get exchange rates for a currency",
                inputSchema: {
                  type: "object",
                  properties: {
                    base: { type: "string", description: "Base currency (default: USD)" },
                  },
                  required: [],
                },
              },
            ],
          });
        } else if (msg.method === "tools/call" && initialized) {
          const { name, arguments: args } = msg.params;

          if (name === "exchange") {
            const { amount, from, to } = z.object({
              amount: z.number(),
              from: z.string().toUpperCase(),
              to: z.string().toUpperCase(),
            }).parse(args);

            if (!EXCHANGE_RATES[from] || !EXCHANGE_RATES[to]) {
              sendError(socket, id, -32602, `Unsupported currency: ${!EXCHANGE_RATES[from] ? from : to}`);
              continue;
            }

            const usdAmount = amount / EXCHANGE_RATES[from];
            const result = usdAmount * EXCHANGE_RATES[to];
            
            sendResponse(socket, id, {
              content: [{ type: "text", text: `${amount} ${from} = ${result.toFixed(2)} ${to}` }],
            });
          } else if (name === "rates") {
            const { base = "USD" } = args;
            const baseRate = EXCHANGE_RATES[base.toUpperCase()];
            
            if (!baseRate) {
              sendError(socket, id, -32602, `Unsupported currency: ${base}`);
              continue;
            }

            const rates = {};
            for (const [curr, rate] of Object.entries(EXCHANGE_RATES)) {
              rates[curr] = (rate / baseRate).toFixed(4);
            }

            sendResponse(socket, id, {
              content: [{ type: "text", text: JSON.stringify(rates, null, 2) }],
            });
          } else {
            sendError(socket, id, -32601, `Unknown tool: ${name}`);
          }
        } else if (!initialized) {
          sendError(socket, id, -32602, "Not initialized");
        } else {
          sendError(socket, id, -32601, "Method not found");
        }
      } catch (err) {
        console.error("Error:", err.message);
        sendError(socket, id, -32603, err.message);
      }
    }
  });

  socket.on("close", () => {
    console.error("Client disconnected");
  });
});

server.listen(5001, () => {
  console.error("Exchange Server listening on port 5001");
  console.error("Test with: nc localhost 5001");
});