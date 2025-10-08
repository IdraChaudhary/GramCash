/**
 * Offline Manager for GramCash
 * Handles data synchronization in low-connectivity environments
 */

class OfflineManager {
  constructor() {
    this.syncQueue = [];
    this.isOnline = false;
    this.syncInProgress = false;
    this.maxRetries = 3;
    
    this.init();
  }

  init() {
    // Listen for network status changes
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('online', this.handleOnline.bind(this));
      window.addEventListener('offline', this.handleOffline.bind(this));
      this.isOnline = navigator.onLine;
    }
  }

  handleOnline() {
    this.isOnline = true;
    console.log('Device came online, starting sync...');
    this.processQueue();
  }

  handleOffline() {
    this.isOnline = false;
    console.log('Device went offline, queuing operations...');
  }

  /**
   * Queue an action for synchronization
   * @param {string} action - Action type (e.g., 'user_profile', 'document_upload')
   * @param {Object} data - Data to sync
   * @param {string} endpoint - API endpoint
   * @returns {Promise}
   */
  async queueAction(action, data, endpoint) {
    const queueItem = {
      id: this.generateId(),
      action,
      data,
      endpoint,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'queued'
    };

    this.syncQueue.push(queueItem);
    await this.saveQueueToStorage();

    // Try to process immediately if online
    if (this.isOnline && !this.syncInProgress) {
      await this.processQueue();
    }

    return queueItem.id;
  }

  /**
   * Process the synchronization queue
   */
  async processQueue() {
    if (this.syncInProgress || !this.isOnline || this.syncQueue.length === 0) {
      return;
    }

    this.syncInProgress = true;

    try {
      // Load queue from storage
      await this.loadQueueFromStorage();

      // Process items in order
      for (let i = 0; i < this.syncQueue.length; i++) {
        const item = this.syncQueue[i];
        
        if (item.status === 'queued' || item.status === 'failed') {
          await this.processQueueItem(item);
        }
      }

      // Clean up completed items
      this.syncQueue = this.syncQueue.filter(item => 
        item.status !== 'completed' && item.retryCount < this.maxRetries
      );

      await this.saveQueueToStorage();

    } catch (error) {
      console.error('Error processing sync queue:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Process a single queue item
   * @param {Object} item - Queue item to process
   */
  async processQueueItem(item) {
    try {
      console.log(`Processing queued action: ${item.action}`);

      // Simulate API call (replace with actual API calls)
      const response = await this.makeAPICall(item.endpoint, item.data);
      
      item.status = 'completed';
      item.completedAt = Date.now();
      
      console.log(`Successfully synced action: ${item.action}`);

    } catch (error) {
      console.error(`Failed to sync action ${item.action}:`, error);
      
      item.status = 'failed';
      item.retryCount++;
      item.lastError = error.message;
      item.lastRetry = Date.now();

      // Implement exponential backoff
      if (item.retryCount < this.maxRetries) {
        const backoffTime = this.calculateBackoff(item.retryCount);
        setTimeout(() => {
          this.processQueueItem(item);
        }, backoffTime);
      }
    }
  }

  /**
   * Make API call with chunked upload support
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Data to send
   * @returns {Promise}
   */
  async makeAPICall(endpoint, data) {
    // For large files, implement chunked uploads
    if (data?.fileSize > 1024 * 1024) { // 1MB threshold
      return await this.chunkedUpload(endpoint, data);
    }

    // Regular API call for small payloads
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Implement chunked file upload
   * @param {string} endpoint - API endpoint
   * @param {Object} fileData - File data to upload
   * @returns {Promise}
   */
  async chunkedUpload(endpoint, fileData) {
    const CHUNK_SIZE = 256 * 1024; // 256KB chunks
    const file = fileData.file;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const uploadId = this.generateId();

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const formData = new FormData();
      formData.append('chunk', chunk);
      formData.append('chunkIndex', chunkIndex);
      formData.append('totalChunks', totalChunks);
      formData.append('uploadId', uploadId);
      formData.append('fileName', file.name);

      const response = await fetch(`${endpoint}/chunk`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Chunk upload failed: HTTP ${response.status}`);
      }
    }

    // Finalize upload
    const finalizeResponse = await fetch(`${endpoint}/finalize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`
      },
      body: JSON.stringify({
        uploadId,
        fileName: file.name,
        totalChunks
      })
    });

    return await finalizeResponse.json();
  }

  /**
   * Calculate exponential backoff time
   * @param {number} retryCount - Number of retry attempts
   * @returns {number} Backoff time in milliseconds
   */
  calculateBackoff(retryCount) {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    return Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
  }

  /**
   * Generate unique ID for queue items
   * @returns {string} Unique ID
   */
  generateId() {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get authentication token
   * @returns {string} Auth token
   */
  getAuthToken() {
    // Implement token retrieval from secure storage
    return localStorage.getItem('auth_token') || '';
  }

  /**
   * Save queue to persistent storage
   */
  async saveQueueToStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('gramcash_sync_queue', JSON.stringify(this.syncQueue));
      }
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }

  /**
   * Load queue from persistent storage
   */
  async loadQueueFromStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem('gramcash_sync_queue');
        if (stored) {
          this.syncQueue = JSON.parse(stored);
        }
      }
    } catch (error) {
      console.error('Failed to load sync queue:', error);
      this.syncQueue = [];
    }
  }

  /**
   * Get queue status for debugging
   * @returns {Object} Queue status information
   */
  getQueueStatus() {
    return {
      total: this.syncQueue.length,
      queued: this.syncQueue.filter(item => item.status === 'queued').length,
      failed: this.syncQueue.filter(item => item.status === 'failed').length,
      completed: this.syncQueue.filter(item => item.status === 'completed').length,
     
