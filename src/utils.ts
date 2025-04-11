/**
 * Creates a debounced function that delays invoking the provided function
 * until after the specified wait time has elapsed since the last time it was invoked.
 * 
 * @param func The function to debounce
 * @param wait The number of milliseconds to delay
 * @returns A debounced version of the provided function
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;
    
    return function(this: any, ...args: Parameters<T>): void {
        const later = () => {
            timeout = null;
            func.apply(this, args);
        };
        
        if (timeout !== null) {
            clearTimeout(timeout);
        }
        
        timeout = setTimeout(later, wait);
    };
}

/**
 * Checks if a path is in an excluded pattern list.
 * 
 * @param path The path to check
 * @param patterns Array of glob patterns to check against
 * @returns True if the path matches any pattern
 */
export function isPathExcluded(path: string, patterns: string[]): boolean {
    // Simple implementation - can be enhanced with proper glob matching
    return patterns.some(pattern => {
        // Convert glob pattern to regex pattern
        const regexPattern = pattern
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');
        
        const regex = new RegExp(regexPattern);
        return regex.test(path);
    });
}

/**
 * Gets a formatted timestamp string
 * 
 * @returns Current timestamp formatted as YYYY-MM-DD HH:MM:SS
 */
export function getTimestamp(): string {
    const now = new Date();
    return now.toISOString().replace('T', ' ').substr(0, 19);
}
