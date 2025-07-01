//accessibility-analyzer\src\services\api.js

// API configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// API client class for handling requests
class AccessibilityAPI {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = localStorage.getItem('token');
  }

   setToken(token) { // NEW method to manage token
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  getToken() { // NEW method to retrieve token
    return this.token || localStorage.getItem('token');
  }

  // Generic request handler with error handling and retries
  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.getToken() && { 'x-auth-token': this.getToken() }),
        ...options.headers
      },
      ...options
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401 && this.getToken()) { // **NEW: Token expiration/invalidity handling**
          this.setToken(null); // Clear invalid token locally
          // You might want to dispatch a global logout event here if using Redux/Context
          console.warn('Authentication token expired or invalid. User logged out.');
        }
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }


  // --- AUTH METHODS --- //
  async register(username, password) { //
    const response = await this.makeRequest('/auth/register', { //
      method: 'POST', //
      body: JSON.stringify({ username, password }) //
    });
    this.setToken(response.token); // Store token on successful registration //
    return response; //
  }

  async login(username, password) { //
    const response = await this.makeRequest('/auth/login', { //
      method: 'POST', //
      body: JSON.stringify({ username, password }) //
    });
    this.setToken(response.token); // Store token on successful login //
    return response; //
  }

  logout() { //
    this.setToken(null); // Clear token //
  }

  async getMe() { //
    if (!this.getToken()) { //
      return null; // Not authenticated //
    }
    try { //
      const user = await this.makeRequest('/auth/me'); // Fetch user data //
      return user; //
    } catch (error) { //
      console.error('Failed to fetch user data:', error); //
      this.setToken(null); // Clear token if authentication fails //
      return null; //
    }
  }
  // --- END AUTH METHODS ---
// 


  // Health check to verify server is running
  async healthCheck() {
    try {
      const response = await this.makeRequest('/health');
      return response;
    } catch (error) {
      throw new Error('Unable to connect to accessibility analysis server. Please ensure the backend is running.');
    }
  }

  // Main function to analyze website accessibility
  async analyzeWebsite(url, options = {}) {
    if (!url) {
      throw new Error('URL is required for analysis');
    }

    // Validate URL format
    try {
      new URL(url.startsWith('http') ? url : `https://${url}`);
    } catch {
      throw new Error('Please provide a valid URL');
    }

    const requestBody = {
      url: url,
      options: {
        waitTime: options.waitTime || 2000,
        includeRaw: options.includeRaw || false,
        rules: options.rules || null,
        tags: options.tags || ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'],
        ...options
      }
    };

    try {
      console.log('Starting website analysis...', url);
      const startTime = Date.now();
      
      const response = await this.makeRequest('/analyze', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const endTime = Date.now();
      const analysisTime = (endTime - startTime) / 1000;
      
      console.log(`Analysis completed in ${analysisTime.toFixed(2)}s`);
      
      // Add client-side metadata
      response.clientMetadata = {
        requestTime: new Date().toISOString(),
        analysisTime: `${analysisTime.toFixed(2)}s`,
        requestId: this.generateRequestId()
      };

      return response;
    } catch (error) {
      // Enhanced error handling with user-friendly messages
      if (error.message.includes('fetch')) {
        throw new Error('Unable to connect to the analysis server. Please check your internet connection and try again.');
      }
      
      if (error.message.includes('timeout') || error.message.includes('408')) {
        throw new Error('The analysis is taking longer than expected. The website might be slow to load or temporarily unavailable.');
      }
      
      if (error.message.includes('404') || error.message.includes('not found')) {
        throw new Error('The website could not be found. Please check the URL and try again.');
      }
      
      if (error.message.includes('403') || error.message.includes('refused')) {
        throw new Error('Access to the website was denied. The site might be blocking automated analysis.');
      }

      throw error;
    }
  }

  // Get available accessibility rules
  async getRules() {
    try {
      const response = await this.makeRequest('/rules');
      return response.rules;
    } catch (error) {
      console.warn('Failed to fetch accessibility rules:', error);
      return [];
    }
  }

  // Batch analyze multiple URLs
  async analyzeMultipleUrls(urls, options = {}) {
    if (!Array.isArray(urls) || urls.length === 0) {
      throw new Error('Please provide an array of URLs to analyze');
    }

    const results = [];
    const errors = [];

    // Process URLs with rate limiting to avoid overwhelming the server
    for (let i = 0; i < urls.length; i++) {
      try {
        console.log(`Analyzing ${i + 1}/${urls.length}: ${urls[i]}`);
        const result = await this.analyzeWebsite(urls[i], options);
        results.push(result);
        
        // Add delay between requests to be respectful
        if (i < urls.length - 1) {
          await this.delay(options.delayBetweenRequests || 1000);
        }
      } catch (error) {
        errors.push({ url: urls[i], error: error.message });
        console.error(`Failed to analyze ${urls[i]}:`, error.message);
      }
    }

    return {
      results,
      errors,
      summary: {
        total: urls.length,
        successful: results.length,
        failed: errors.length
      }
    };
  }

  // Compare accessibility between two URLs
  async compareWebsites(url1, url2, options = {}) {
    try {
      const [result1, result2] = await Promise.all([
        this.analyzeWebsite(url1, options),
        this.analyzeWebsite(url2, options)
      ]);

      return {
        comparison: {
          url1: result1,
          url2: result2,
          scoreDifference: result2.score - result1.score,
          issuesDifference: result2.summary.totalIssues - result1.summary.totalIssues
        },
        summary: {
          better: result1.score > result2.score ? url1 : url2,
          worse: result1.score < result2.score ? url1 : url2,
          scoreDiff: Math.abs(result1.score - result2.score)
        }
      };
    } catch (error) {
      throw new Error(`Failed to compare websites: ${error.message}`);
    }
  }
 async getAnalysisHistoryFromDB() { //
    if (!this.getToken()) { //
      console.warn('Not authenticated. Cannot fetch history.'); //
      return []; // Return empty if not logged in //
    }
    try { //
      const response = await this.makeRequest('/history'); //
      return response; // Backend returns an array directly //
    } catch (error) { //
      console.error('Failed to fetch analysis history from DB:', error); //
      throw new Error('Could not load analysis history.'); //
    }
  }
  // Helper method to generate unique request IDs
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Helper method for delays
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get analysis history (if implementing local storage)
  getAnalysisHistory() {
    try {
      const history = localStorage.getItem('accessibility_analysis_history');
      return history ? JSON.parse(history) : [];
    } catch (error) {
      console.warn('Failed to retrieve analysis history:', error);
      return [];
    }
  }

  // Save analysis to history (if implementing local storage)
  saveAnalysisToHistory(analysis) {
    try {
      const history = this.getAnalysisHistory();
      const newEntry = {
        id: this.generateRequestId(),
        url: analysis.url,
        score: analysis.score,
        timestamp: new Date().toISOString(),
        summary: analysis.summary
      };
      
      history.unshift(newEntry);
      
      // Keep only last 50 analyses
      const trimmedHistory = history.slice(0, 50);
      localStorage.setItem('accessibility_analysis_history', JSON.stringify(trimmedHistory));
      
      return newEntry.id;
    } catch (error) {
      console.warn('Failed to save analysis to history:', error);
      return null;
    }
  }

  // Clear analysis history
  clearAnalysisHistory() {
    try {
      localStorage.removeItem('accessibility_analysis_history');
      return true;
    } catch (error) {
      console.warn('Failed to clear analysis history:', error);
      return false;
    }
  }
}

// Create API instance
const api = new AccessibilityAPI();

// Export the main function for backward compatibility
export const analyzeWebsite = async (url, options = {}) => {
  try {
    const result = await api.analyzeWebsite(url, options);
    
    // Save to history if analysis was successful
    // api.saveAnalysisToHistory(result);
    
    return result;
  } catch (error) {
    console.error('Website analysis failed:', error);
    throw error;
  }
};

// Export additional functions
export const healthCheck = () => api.healthCheck();
export const getRules = () => api.getRules();
export const analyzeMultipleUrls = (urls, options) => api.analyzeMultipleUrls(urls, options);
export const compareWebsites = (url1, url2, options) => api.compareWebsites(url1, url2, options);
// export const getAnalysisHistory = () => api.getAnalysisHistory();
export const clearAnalysisHistory = () => api.clearAnalysisHistory();

export const registerUser = (username, password) => api.register(username, password); //
export const loginUser = (username, password) => api.login(username, password); //
export const logoutUser = () => api.logout(); //
export const getCurrentUser = () => api.getMe(); // To check if user is logged in //

// ... (rest of existing exports) ...

// Export the database history function //
export const getAnalysisHistory = () => api.getAnalysisHistoryFromDB(); //

// Export the API class for advanced usage
export { AccessibilityAPI };

// Default export
export default api;
