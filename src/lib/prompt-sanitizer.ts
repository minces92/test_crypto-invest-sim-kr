export function sanitizeUserInput(input: string): string {
    // 1. Length limit
    const maxLength = 500;
    let sanitized = input.slice(0, maxLength);

    // 2. Remove dangerous patterns
    const dangerousPatterns = [
        /ignore previous instructions/gi,
        /forget all/gi,
        /system:/gi,
        /```/g,  // Code block
    ];

    dangerousPatterns.forEach(pattern => {
        sanitized = sanitized.replace(pattern, '');
    });

    // 3. Remove HTML/Script tags
    sanitized = sanitized.replace(/<[^>]*>/g, '');

    return sanitized.trim();
}
