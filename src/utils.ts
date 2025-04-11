/**
 * Debounce a function call
 * @param func The function to debounce
 * @param wait Time to wait in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;
    
    return function(...args: Parameters<T>): void {
        const later = () => {
            timeout = null;
            func(...args);
        };
        
        if (timeout !== null) {
            clearTimeout(timeout);
        }
        
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle a function call
 * @param func The function to throttle
 * @param limit Time limit in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => any>(func: T, limit: number): (...args: Parameters<T>) => void {
    let inThrottle = false;
    
    return function(...args: Parameters<T>): void {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            
            setTimeout(() => {
                inThrottle = false;
            }, limit);
        }
    };
}

/**
 * Format a file size in bytes to a human-readable string
 * @param bytes File size in bytes
 * @returns Formatted file size
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) {
        return '0 B';
    }
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

/**
 * Get the file extension of a path
 * @param filePath File path
 * @returns File extension (lowercase, without the dot)
 */
export function getFileExtension(filePath: string): string {
    const match = filePath.match(/\.([^.]+)$/);
    return match ? match[1].toLowerCase() : '';
}

/**
 * Ensure a string has a trailing slash
 * @param str The string to check
 * @returns The string with a trailing slash
 */
export function ensureTrailingSlash(str: string): string {
    if (!str.endsWith('/')) {
        return str + '/';
    }
    return str;
}

/**
 * Escape a string for use in a regular expression
 * @param str The string to escape
 * @returns The escaped string
 */
export function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Convert a glob pattern to a regular expression
 * @param pattern The glob pattern
 * @returns Regular expression
 */
export function globToRegExp(pattern: string): RegExp {
    const escaped = escapeRegExp(pattern)
        .replace(/\\\*/g, '.*')
        .replace(/\\\?/g, '.');
        
    return new RegExp(`^${escaped}$`, 'i');
}

/**
 * Delay execution for a specified time
 * @param ms Time to wait in milliseconds
 * @returns Promise that resolves after the delay
 */
export function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a unique ID
 * @returns Unique ID string
 */
export function uniqueId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}
