// ============================================
// INFERRA SECURITY ENGINE - LAYER 1
// Detects secrets, PII, and compliance violations
// ============================================

import type { SecurityAnalysis, SecretType, PIIType, SecretLocation, PIILocation, ComplianceViolation } from '../../types';

const SECRET_PATTERNS: Record<SecretType, RegExp[]> = {
  'api-key': [
    /\bsk-[a-zA-Z0-9]{32,}\b/g,
    /\bAIza[a-zA-Z0-9_-]{35}\b/g,
    /\bghp_[a-zA-Z0-9]{36}\b/g,
    /\bxoxb-[a-zA-Z0-9-]+\b/g,
  ],
  'password': [
    /\b(password|passwd|pwd)\s*[:=]\s*['"]?([^\s'"]{6,})['"]?/gi,
  ],
  'token': [
    /\b(token|bearer|auth_token)\s*[:=]\s*['"]?([a-zA-Z0-9_.-]{20,})['"]?/gi,
    /\bBearer\s+[a-zA-Z0-9_.-]{20,}/g,
  ],
  'private-key': [
    /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/g,
    /-----BEGIN\s+EC\s+PRIVATE\s+KEY-----/g,
    /-----BEGIN\s+OPENSSH\s+PRIVATE\s+KEY-----/g,
  ],
  'aws-credentials': [
    /\bAKIA[0-9A-Z]{16}\b/g,
    /\b(aws_secret_access_key)\s*[:=]\s*['"]?([a-zA-Z0-9/+=]{40})['"]?/gi,
  ],
  'database-url': [
    /\b(mongodb|postgresql|mysql|redis|postgres):\/\/[^\s'"]+/gi,
  ],
  'oauth-secret': [
    /\b(client_secret|oauth_secret)\s*[:=]\s*['"]?([a-zA-Z0-9_-]{20,})['"]?/gi,
  ],
  'ssh-key': [
    /ssh-rsa\s+[A-Za-z0-9+\/=]+/g,
    /ssh-ed25519\s+[A-Za-z0-9+\/=]+/g,
  ],
  'certificate': [
    /-----BEGIN\s+CERTIFICATE-----/g,
  ],
};

const PII_PATTERNS: Record<PIIType, RegExp[]> = {
  'email': [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g],
  'phone': [
    /\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  ],
  'ssn': [/\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g],
  'credit-card': [
    /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/g,
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
  ],
  'address': [
    /\b\d{1,5}\s+[A-Za-z]+\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr)\b/gi,
  ],
  'name': [
    /\b(?:my name is|i am|i'm|called)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/gi,
  ],
  'date-of-birth': [
    /\b(?:born|dob|birthday)\s*[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/gi,
  ],
  'ip-address': [/\b(?:\d{1,3}\.){3}\d{1,3}\b/g],
  'medical': [
    /\b(diagnosis|patient|prescription|medication|treatment|symptom)\s*[:\s]+[A-Za-z0-9]+/gi,
  ],
  'financial': [
    /\b(account_number|routing_number|balance)\s*[:\s]*\d+/gi,
  ],
  'passport': [/\b[A-Z]{1,2}\d{6,9}\b/g],
  'drivers-license': [/\b[A-Z]{1,2}\d{5,8}\b/g],
};

const COMPLIANCE_KEYWORDS: Record<string, { keywords: string[]; dataTypes: string[]; description: string }> = {
  'gdpr': {
    keywords: ['european', 'eu citizen', 'gdpr', 'data subject', 'right to be forgotten', 'personal data'],
    dataTypes: ['email', 'name', 'address', 'phone'],
    description: 'Contains EU personal data subject to GDPR',
  },
  'hipaa': {
    keywords: ['patient', 'medical record', 'diagnosis', 'treatment', 'prescription', 'phi', 'hipaa', 'health'],
    dataTypes: ['medical', 'ssn', 'date-of-birth'],
    description: 'Contains Protected Health Information (PHI)',
  },
  'pci-dss': {
    keywords: ['credit card', 'card number', 'cvv', 'cardholder', 'pci', 'payment'],
    dataTypes: ['credit-card'],
    description: 'Contains payment card data',
  },
  'ccpa': {
    keywords: ['california', 'ccpa', 'consumer rights', 'data sale'],
    dataTypes: ['email', 'name', 'address', 'phone'],
    description: 'Contains California consumer data',
  },
};

export function analyzeSecurityLayer(prompt: string, policy: { piiPolicy: string; secretPolicy: string }): SecurityAnalysis {
  const secretLocations = detectSecrets(prompt);
  const piiLocations = detectPII(prompt);
  const complianceViolations = checkCompliance(prompt, piiLocations);

  const hasSecrets = secretLocations.length > 0;
  const hasPII = piiLocations.length > 0;

  // Calculate risk score
  let riskScore = 0;
  riskScore += secretLocations.length * 20;
  riskScore += piiLocations.filter(p => ['ssn', 'credit-card', 'medical'].includes(p.type)).length * 25;
  riskScore += piiLocations.filter(p => !['ssn', 'credit-card', 'medical'].includes(p.type)).length * 10;
  riskScore += complianceViolations.filter(c => c.severity === 'critical').length * 30;
  riskScore += complianceViolations.filter(c => c.severity === 'high').length * 20;
  riskScore = Math.min(100, riskScore);

  const securityScore = 100 - riskScore;

  // Determine if blocked
  let blocked = false;
  let blockReason: string | undefined;

  if (policy.secretPolicy === 'block' && hasSecrets) {
    blocked = true;
    blockReason = `Secrets detected: ${[...new Set(secretLocations.map(s => s.type))].join(', ')}`;
  }
  if (policy.piiPolicy === 'block' && hasPII) {
    blocked = true;
    blockReason = blockReason 
      ? `${blockReason}; PII detected: ${[...new Set(piiLocations.map(p => p.type))].join(', ')}`
      : `PII detected: ${[...new Set(piiLocations.map(p => p.type))].join(', ')}`;
  }

  // Sanitize if policy allows
  let sanitizedPrompt: string | undefined;
  if (policy.piiPolicy === 'sanitize' && hasPII) {
    sanitizedPrompt = sanitizePrompt(prompt, piiLocations, secretLocations);
  }

  return {
    securityScore,
    riskScore,
    hasSecrets,
    secretTypes: [...new Set(secretLocations.map(s => s.type))],
    secretLocations,
    hasPII,
    piiTypes: [...new Set(piiLocations.map(p => p.type))],
    piiLocations,
    complianceViolations,
    blocked,
    blockReason,
    sanitizedPrompt,
  };
}

function detectSecrets(text: string): SecretLocation[] {
  const locations: SecretLocation[] = [];

  for (const [type, patterns] of Object.entries(SECRET_PATTERNS)) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(text)) !== null) {
        locations.push({
          type: type as SecretType,
          start: match.index,
          end: match.index + match[0].length,
          pattern: pattern.source.slice(0, 30),
          confidence: 0.9,
        });
      }
    }
  }

  return deduplicateLocations(locations);
}

function detectPII(text: string): PIILocation[] {
  const locations: PIILocation[] = [];

  for (const [type, patterns] of Object.entries(PII_PATTERNS)) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const value = match[0];
        locations.push({
          type: type as PIIType,
          start: match.index,
          end: match.index + value.length,
          value,
          masked: maskValue(value, type as PIIType),
          confidence: 0.85,
        });
      }
    }
  }

  return deduplicateLocations(locations);
}

function checkCompliance(text: string, piiLocations: PIILocation[]): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];
  const lowerText = text.toLowerCase();
  const detectedPIITypes = new Set(piiLocations.map(p => p.type));

  for (const [framework, config] of Object.entries(COMPLIANCE_KEYWORDS)) {
    const matchedKeywords = config.keywords.filter(kw => lowerText.includes(kw));
    const matchedDataTypes = config.dataTypes.filter(dt => detectedPIITypes.has(dt as PIIType));

    if (matchedKeywords.length > 0 || matchedDataTypes.length > 0) {
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (matchedDataTypes.length > 0) severity = 'medium';
      if (framework === 'hipaa' && matchedDataTypes.length > 0) severity = 'high';
      if (framework === 'pci-dss' && matchedDataTypes.includes('credit-card')) severity = 'critical';

      violations.push({
        framework: framework as any,
        description: config.description,
        severity,
        dataTypes: matchedDataTypes,
      });
    }
  }

  return violations;
}

function maskValue(value: string, type: PIIType): string {
  switch (type) {
    case 'email':
      const [local, domain] = value.split('@');
      return `${local[0]}***@${domain}`;
    case 'phone':
      return value.replace(/\d(?=\d{4})/g, '*');
    case 'ssn':
      return '***-**-' + value.slice(-4);
    case 'credit-card':
      return '**** **** **** ' + value.replace(/\D/g, '').slice(-4);
    default:
      if (value.length <= 4) return '****';
      return value[0] + '*'.repeat(Math.min(value.length - 2, 10)) + value[value.length - 1];
  }
}

function sanitizePrompt(text: string, piiLocations: PIILocation[], secretLocations: SecretLocation[]): string {
  const allLocations = [
    ...piiLocations.map(p => ({ start: p.start, end: p.end, replacement: p.masked })),
    ...secretLocations.map(s => ({ start: s.start, end: s.end, replacement: '[REDACTED]' })),
  ].sort((a, b) => b.start - a.start);

  let result = text;
  for (const loc of allLocations) {
    result = result.slice(0, loc.start) + loc.replacement + result.slice(loc.end);
  }
  return result;
}

function deduplicateLocations<T extends { start: number; end: number }>(locations: T[]): T[] {
  const seen = new Set<string>();
  return locations.filter(loc => {
    const key = `${loc.start}-${loc.end}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
