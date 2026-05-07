import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server(
  {
    name: "currency-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler("tools/list", async () => {
  return {
    tools: [
      {
        name: "convert_currency",
        description: "Convert currency exchange rates",
        inputSchema: {
          type: "object",
          properties: {
            amount: {
              type: "number",
              description: "Amount to convert",
            },
            from: {
              type: "string",
              description: "Source currency",
            },
            to: {
              type: "string",
              description: "Target currency",
            },
          },
          required: ["amount", "from", "to"],
        },
      },
    ],
  };
});

server.setRequestHandler("tools/call", async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "convert_currency") {
    const url =
      `https://api.frankfurter.app/latest` +
      `?amount=${args.amount}` +
      `&from=${args.from.toUpperCase()}` +
      `&to=${args.to.toUpperCase()}`;

    const response = await fetch(url);
    const data = await response.json();

    const result = data.rates[args.to.toUpperCase()];

    return {
      content: [
        {
          type: "text",
          text:
            `${args.amount} ${args.from.toUpperCase()} = ` +
            `${result} ${args.to.toUpperCase()}`,
        },
      ],
    };
  }

  throw new Error("Unknown tool");
});

const transport = new StdioServerTransport();
await server.connect(transport);