import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });

interface AppSecrets {
  passwordHash: string;
  jwtSecret: string;
}

let cachedSecrets: AppSecrets | null = null;

/**
 * Retrieve secrets from AWS Secrets Manager
 * Caches the result for the lifetime of the Lambda execution environment
 */
export async function getSecrets(): Promise<AppSecrets> {
  if (cachedSecrets) {
    return cachedSecrets;
  }

  const secretName = process.env.SECRET_NAME || 'pdf-directory-secrets';

  try {
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: secretName,
      })
    );

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
  } catch (error) {
    console.error('Failed to retrieve secrets from Secrets Manager:', error);
    throw new Error('Unable to load application secrets');
  }
}
