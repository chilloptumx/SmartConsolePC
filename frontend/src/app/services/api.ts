// API client for backend communication

// Prefer an explicit VITE_API_URL if provided; otherwise use same-origin.
// In local Docker dev we run Vite with a `/api` proxy (see `vite.config.ts`), so same-origin works
// and avoids hard-coding host ports (5000 vs 5001).
const API_URL = import.meta.env.VITE_API_URL ?? '';

interface ApiResponse<T> {
  data?: T;
  error?: string;
  success: boolean;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Machines
  async getMachines() {
    return this.request<any[]>('/api/machines');
  }

  async getMachine(id: string) {
    return this.request<any>(`/api/machines/${id}`);
  }

  async createMachine(data: { hostname: string; ipAddress: string; pcModel?: string }) {
    return this.request<any>('/api/machines', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateMachine(id: string, data: any) {
    return this.request<any>(`/api/machines/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteMachine(id: string) {
    return this.request<any>(`/api/machines/${id}`, {
      method: 'DELETE',
    });
  }

  async triggerCheck(machineId: string, checkType: string) {
    return this.request<any>(`/api/machines/${machineId}/check`, {
      method: 'POST',
      body: JSON.stringify({ checkType }),
    });
  }

  // Registry Checks
  async getRegistryChecks() {
    return this.request<any[]>('/api/config/registry-checks');
  }

  async createRegistryCheck(data: any) {
    return this.request<any>('/api/config/registry-checks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateRegistryCheck(id: string, data: any) {
    return this.request<any>(`/api/config/registry-checks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteRegistryCheck(id: string) {
    return this.request<any>(`/api/config/registry-checks/${id}`, {
      method: 'DELETE',
    });
  }

  // File Checks
  async getFileChecks() {
    return this.request<any[]>('/api/config/file-checks');
  }

  async createFileCheck(data: any) {
    return this.request<any>('/api/config/file-checks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateFileCheck(id: string, data: any) {
    return this.request<any>(`/api/config/file-checks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteFileCheck(id: string) {
    return this.request<any>(`/api/config/file-checks/${id}`, {
      method: 'DELETE',
    });
  }

  // Service Checks
  async getServiceChecks() {
    return this.request<any[]>('/api/config/service-checks');
  }

  async createServiceCheck(data: any) {
    return this.request<any>('/api/config/service-checks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateServiceCheck(id: string, data: any) {
    return this.request<any>(`/api/config/service-checks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteServiceCheck(id: string) {
    return this.request<any>(`/api/config/service-checks/${id}`, {
      method: 'DELETE',
    });
  }

  // User Checks
  async getUserChecks() {
    return this.request<any[]>('/api/config/user-checks');
  }

  async createUserCheck(data: any) {
    return this.request<any>('/api/config/user-checks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateUserCheck(id: string, data: any) {
    return this.request<any>(`/api/config/user-checks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteUserCheck(id: string) {
    return this.request<any>(`/api/config/user-checks/${id}`, {
      method: 'DELETE',
    });
  }

  // System Checks
  async getSystemChecks() {
    return this.request<any[]>('/api/config/system-checks');
  }

  async createSystemCheck(data: any) {
    return this.request<any>('/api/config/system-checks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSystemCheck(id: string, data: any) {
    return this.request<any>(`/api/config/system-checks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteSystemCheck(id: string) {
    return this.request<any>(`/api/config/system-checks/${id}`, {
      method: 'DELETE',
    });
  }

  // Locations
  async getLocations() {
    return this.request<any[]>('/api/machines/locations');
  }

  async createLocation(data: { name: string }) {
    return this.request<any>('/api/machines/locations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateLocation(id: string, data: { name: string }) {
    return this.request<any>(`/api/machines/locations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteLocation(id: string) {
    return this.request<any>(`/api/machines/locations/${id}`, {
      method: 'DELETE',
    });
  }

  // Scheduled Jobs
  async getScheduledJobs() {
    return this.request<any[]>('/api/schedules/jobs');
  }

  async createScheduledJob(data: any) {
    return this.request<any>('/api/schedules/jobs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateScheduledJob(id: string, data: any) {
    return this.request<any>(`/api/schedules/jobs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteScheduledJob(id: string) {
    return this.request<any>(`/api/schedules/jobs/${id}`, {
      method: 'DELETE',
    });
  }

  async runJobNow(id: string) {
    return this.request<any>(`/api/schedules/jobs/${id}/run-now`, {
      method: 'POST',
    });
  }

  // Data/Results
  async getResults(params?: Record<string, any>) {
    const query = new URLSearchParams(params).toString();
    return this.request<any>(`/api/data/results${query ? `?${query}` : ''}`);
  }

  async getUserInfoUsers(params: Record<string, any> = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request<string[]>(`/api/data/users${query ? `?${query}` : ''}`);
  }

  async getCheckResults(params?: Record<string, any>) {
    const query = new URLSearchParams(params).toString();
    return this.request<any[]>(`/api/data/results${query ? `?${query}` : ''}`);
  }

  async getCollectedObjects(machineId: string, params: Record<string, any> = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request<any[]>(
      `/api/data/collected-objects?machineId=${encodeURIComponent(machineId)}${query ? `&${query}` : ''}`
    );
  }

  async getCollectedObjectsAll(params: Record<string, any> = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request<any[]>(`/api/data/collected-objects?scope=all${query ? `&${query}` : ''}`);
  }

  async getLatestResultsForObjects(payload: { machineIds: string[]; objects: { checkType: string; checkName: string }[]; since?: string }) {
    return this.request<{ results: any[] }>(`/api/data/latest-results`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Ad-hoc scan
  async runAdHocScan(payload: {
    machineIds: string[];
    builtIns?: { ping?: boolean; userInfo?: boolean; systemInfo?: boolean };
    registryCheckIds?: string[];
    fileCheckIds?: string[];
    serviceCheckIds?: string[];
    userCheckIds?: string[];
    systemCheckIds?: string[];
  }) {
    return this.request<{
      startedAt: string;
      machineIds: string[];
      expected: { machineId: string; checkType: string; checkName: string }[];
      expectedCount: number;
    }>(`/api/adhoc-scan/run`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Ad-hoc scan (direct, manual target; not persisted)
  async runAdHocScanDirect(payload: {
    targetHost: string;
    builtIns?: { ping?: boolean; userInfo?: boolean; systemInfo?: boolean };
    registryCheckIds?: string[];
    fileCheckIds?: string[];
    serviceCheckIds?: string[];
    userCheckIds?: string[];
    systemCheckIds?: string[];
  }) {
    return this.request<{
      startedAt: string;
      targetHost: string;
      targetId: string;
      expected: { machineId: string; checkType: string; checkName: string }[];
      expectedCount: number;
      results: any[];
    }>(`/api/adhoc-scan/run-direct`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getResult(id: string) {
    return this.request<any>(`/api/data/results/${id}`);
  }

  async getStats() {
    return this.request<any>('/api/data/stats');
  }

  // Job Monitor
  async getMonitorEvents(params: Record<string, any> = {}) {
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      const s = String(v);
      if (!s || s === 'undefined' || s === 'null') continue;
      clean[k] = s;
    }
    const query = new URLSearchParams(clean).toString();
    return this.request<any>(`/api/monitor/events${query ? `?${query}` : ''}`);
  }

  async exportResults(params?: Record<string, any>) {
    const query = new URLSearchParams(params).toString();
    const url = `${this.baseUrl}/api/data/results/export${query ? `?${query}` : ''}`;
    window.open(url, '_blank');
  }

  // Email Reports
  async getEmailReports() {
    return this.request<any[]>('/api/reports');
  }

  // Settings (read-only)
  async getSmtpSettings() {
    return this.request<any>('/api/settings/smtp');
  }

  async getBuiltInCheckSettings() {
    return this.request<any>('/api/settings/checks');
  }

  // Scan Authentication (WinRM)
  async getScanAuthSettings() {
    return this.request<any>('/api/settings/auth');
  }

  async updateScanAuthSettings(data: any) {
    return this.request<any>('/api/settings/auth', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Database (read-only info + purge)
  async getDatabaseSettings() {
    return this.request<any>('/api/settings/database');
  }

  async purgeDatabaseData(payload: { days?: number | null; confirm: true }) {
    return this.request<any>('/api/settings/database/purge', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async createEmailReport(data: any) {
    return this.request<any>('/api/reports', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateEmailReport(id: string, data: any) {
    return this.request<any>(`/api/reports/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteEmailReport(id: string) {
    return this.request<any>(`/api/reports/${id}`, {
      method: 'DELETE',
    });
  }

  async sendReportNow(id: string) {
    return this.request<any>(`/api/reports/${id}/send-now`, {
      method: 'POST',
    });
  }

  async sendTestEmail(id: string) {
    return this.request<any>(`/api/reports/${id}/send-now`, {
      method: 'POST',
    });
  }

  // Health check
  async healthCheck() {
    return this.request<{ status: string; timestamp: string }>('/health');
  }
}

// Export singleton instance
export const api = new ApiClient(API_URL);

