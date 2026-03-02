import { authService } from './authService';
import { API_BASE_URL } from './apiBase';

export const agentHireService = {
  async getMyAgents() {
    const token = authService.getToken();
    const response = await fetch(`${API_BASE_URL}/agent-hire/my-agents`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  async hireAgent(agentId: string) {
    const token = authService.getToken();
    const response = await fetch(`${API_BASE_URL}/agent-hire/hire/${agentId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  async cancelHire(agentId: string) {
    const token = authService.getToken();
    const response = await fetch(`${API_BASE_URL}/agent-hire/hire/${agentId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  async getHireStatus() {
    const token = authService.getToken();
    const response = await fetch(`${API_BASE_URL}/agent-hire/status`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },
};
