import express from 'express';

const app = express();
app.use(express.json());

const SECRET = process.env.BRIDGE_SECRET || '';
const PORT = process.env.PORT || 3000;

let pendingCmd = null;
let lastPing = 0;

app.get('/toy-next', (req, res) => {
  if (SECRET && req.headers['x-bridge-secret'] !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  lastPing = Date.now();
  const cmd = pendingCmd || { type: 'hello' };
  pendingCmd = null;
  res.json(cmd);
});

const TOOLS = [
  {
    name: 'toy_set_speed',
    description: '设置玩具振动强度',
    inputSchema: {
      type: 'object',
      properties: {
        speed: { type: 'number', description: '强度 0.0-1.0', minimum: 0, maximum: 1 },
        duration: { type: 'number', description: '持续秒数，0表示一直运行' }
      },
      required: ['speed']
    }
  },
  {
    name: 'toy_set_pattern',
    description: '设置玩具振动花样',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: { type: 'integer', description: '花样编号 1-8', minimum: 1, maximum: 8 },
        level: { type: 'number', description: '强度 0.0-1.0' },
        duration: { type: 'number', description: '持续秒数' }
      },
      required: ['pattern']
    }
  },
  {
    name: 'toy_stop',
    description: '立刻停止玩具',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'toy_status',
    description: '查询蓝牙中继是否在线',
    inputSchema: { type: 'object', properties: {} }
  }
];

app.post('/mcp', (req, res) => {
  if (SECRET && req.query.secret !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { method, id, params } = req.body;

  if (method === 'initialize') {
    return res.json({
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'svakom-bridge', version: '1.0.0' }
      }
    });
  }

  if (method === 'tools/list') {
    return res.json({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = params;

    if (name === 'toy_status') {
      const online = (Date.now() - lastPing) < 10000;
      return res.json({
        jsonrpc: '2.0', id,
        result: { content: [{ type: 'text', text: online ? '✅ 蓝牙中继在线' : '❌ 蓝牙中继离线，请确认bridge.py正在运行' }] }
      });
    }

    if (name === 'toy_stop') {
      pendingCmd = { stop: true };
      return res.json({
        jsonrpc: '2.0', id,
        result: { content: [{ type: 'text', text: '⏹ 已发送停止指令' }] }
      });
    }

    if (name === 'toy_set_speed') {
      const speed = Math.max(0, Math.min(1, args.speed || 0));
      const cmd = { speed };
      if (args.duration) cmd.sec = args.duration;
      pendingCmd = cmd;
      return res.json({
        jsonrpc: '2.0', id,
        result: { content: [{ type: 'text', text: `📳 已发送强度指令：${Math.round(speed * 100)}%` }] }
      });
    }

    if (name === 'toy_set_pattern') {
      const pattern = Math.max(1, Math.min(8, args.pattern || 1));
      const level = args.level || 0.6;
      const cmd = { pattern, level };
      if (args.duration) cmd.sec = args.duration;
      pendingCmd = cmd;
      return res.json({
        jsonrpc: '2.0', id,
        result: { content: [{ type: 'text', text: `🌀 已发送花样指令：花样${pattern}` }] }
      });
    }
  }

  if (method && method.startsWith('notifications/')) {
    return res.status(204).end();
  }

  res.json({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } });
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`✅ MCP Server 已启动，端口 ${PORT}`));
