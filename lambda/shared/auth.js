"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = generateToken;
exports.verifyToken = verifyToken;
exports.extractToken = extractToken;
exports.getCorsHeaders = getCorsHeaders;
const jwt = __importStar(require("jsonwebtoken"));
const secrets_1 = require("./secrets");
/**
 * Generate a JWT token
 */
async function generateToken() {
    const secrets = await (0, secrets_1.getSecrets)();
    const payload = {
        authorized: true,
    };
    return jwt.sign(payload, secrets.jwtSecret, {
        expiresIn: '24h',
    });
}
/**
 * Verify and decode JWT token
 */
async function verifyToken(token) {
    try {
        const secrets = await (0, secrets_1.getSecrets)();
        const decoded = jwt.verify(token, secrets.jwtSecret);
        return decoded;
    }
    catch (error) {
        console.error('JWT verification failed:', error);
        return null;
    }
}
/**
 * Extract token from Authorization header
 */
function extractToken(authHeader) {
    if (!authHeader) {
        return null;
    }
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return null;
    }
    return parts[1];
}
/**
 * Get CORS headers
 */
function getCorsHeaders(allowedOrigin = '*') {
    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Auth-Token',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Expose-Headers': 'X-Auth-Token',
    };
}
