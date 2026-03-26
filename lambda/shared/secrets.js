"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSecrets = getSecrets;
const client_secrets_manager_1 = require("@aws-sdk/client-secrets-manager");
const client = new client_secrets_manager_1.SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
let cachedSecrets = null;
/**
 * Retrieve secrets from AWS Secrets Manager
 * Caches the result for the lifetime of the Lambda execution environment
 */
async function getSecrets() {
    if (cachedSecrets) {
        return cachedSecrets;
    }
    const secretName = process.env.SECRET_NAME || 'pdf-directory-secrets';
    try {
        const response = await client.send(new client_secrets_manager_1.GetSecretValueCommand({
            SecretId: secretName,
        }));
        if (!response.SecretString) {
            throw new Error('Secret value is empty');
        }
        const secrets = JSON.parse(response.SecretString);
        if (!secrets.passwordHash || !secrets.jwtSecret) {
            throw new Error('Required secrets (passwordHash, jwtSecret) not found in Secrets Manager');
        }
        cachedSecrets = {
            passwordHash: secrets.passwordHash,
            jwtSecret: secrets.jwtSecret,
        };
        return cachedSecrets;
    }
    catch (error) {
        console.error('Failed to retrieve secrets from Secrets Manager:', error);
        throw new Error('Unable to load application secrets');
    }
}
