import { handleNodeRequest } from '../../server/dev-orchestrator.mjs';

export default async function handler(req, res) {
  req.url = '/ai/chat';
  return handleNodeRequest(req, res);
}
