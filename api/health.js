import { handleNodeRequest } from '../server/dev-orchestrator.mjs';

export default async function handler(req, res) {
  req.url = '/health';
  return handleNodeRequest(req, res);
}
