import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { OneDriveService } from '../services/onedriveService';

interface HealthCheckDetails {
    [key: string]: any;
}

interface HealthCheck {
    status: string;
    details: HealthCheckDetails;
}

interface HealthCheckResponse {
    timestamp: string;
    status: string;
    checks: {
        environment: HealthCheck;
        onedrive: HealthCheck;
        signwell: HealthCheck;
    };
}

export async function health(_request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('Health check initiated');
    
    const checks: HealthCheckResponse = {
        timestamp: new Date().toISOString(),
        status: 'healthy',
        checks: {
            environment: {
                status: 'pass',
                details: {}
            },
            onedrive: {
                status: 'pending',
                details: {}
            },
            signwell: {
                status: 'pass',
                details: {}
            }
        }
    };
    
    // Check environment variables
    const requiredEnvVars = [
        'ONEDRIVE_CLIENT_ID',
        'ONEDRIVE_CLIENT_SECRET', 
        'ONEDRIVE_TENANT_ID',
        'ONEDRIVE_USER_ID'
    ];
    
    const missingVars = [];
    for (const varName of requiredEnvVars) {
        if (!process.env[varName]) {
            missingVars.push(varName);
        }
        checks.checks.environment.details[varName] = process.env[varName] ? 'set' : 'missing';
    }
    
    if (missingVars.length > 0) {
        checks.checks.environment.status = 'fail';
        checks.checks.environment.details['missing'] = missingVars;
        checks.status = 'unhealthy';
    }
    
    // Test OneDrive connection
    try {
        const onedriveService = new OneDriveService();
        
        // Test authentication by trying to get a token
        const authMethod = Reflect.get(onedriveService, 'authenticate').bind(onedriveService);
        await authMethod();
        
        // Test API access by checking the base path
        const getBasePathMethod = Reflect.get(onedriveService, 'getBasePath').bind(onedriveService);
        const basePath = getBasePathMethod();
        
        checks.checks.onedrive.status = 'pass';
        checks.checks.onedrive.details = {
            authenticated: true,
            basePath: basePath,
            userId: process.env.ONEDRIVE_USER_ID || 'not set',
            apiFolder: process.env.ONEDRIVE_API_FOLDER_NAME || 'SLIM Subsidies',
            externalFolder: process.env.ONEDRIVE_EXTERNAL_FOLDER_NAME || 'SignWell Documenten'
        };
        
    } catch (error) {
        checks.checks.onedrive.status = 'fail';
        checks.checks.onedrive.details = {
            error: error instanceof Error ? error.message : 'Unknown error',
            authenticated: false
        };
        checks.status = 'unhealthy';
    }
    
    // Also check SignWell configuration
    const signwellVars = [
        'SIGNWELL_API_KEY',
        'SIGNWELL_APP_ID'
    ];
    
    for (const varName of signwellVars) {
        checks.checks.signwell.details[varName] = process.env[varName] ? 'set' : 'missing';
        if (!process.env[varName]) {
            checks.checks.signwell.status = 'warn';
        }
    }
    
    const statusCode = checks.status === 'healthy' ? 200 : 503;
    
    return {
        status: statusCode,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(checks, null, 2)
    };
}

app.http('health', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: health
});