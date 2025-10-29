#!/usr/bin/env node

/**
 * Script de verificación para MullBot
 * Verifica que todas las configuraciones necesarias estén presentes
 */

import { config } from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

config();

interface VerificationResult {
    success: boolean;
    message: string;
}

class MullBotVerifier {
    
    static async verifyGeminiAPI(): Promise<VerificationResult> {
        try {
            if (!process.env.GEMINI_API_KEY) {
                return {
                    success: false,
                    message: "❌ GEMINI_API_KEY no está configurada en el archivo .env"
                };
            }

            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
            
            // Prueba simple de la API
            const result = await model.generateContent("Hola MullBot, ¿cómo estás?");
            const response = result.response.text();
            
            if (response && response.length > 0) {
                return {
                    success: true,
                    message: "✅ API de Gemini configurada correctamente"
                };
            } else {
                return {
                    success: false,
                    message: "❌ La API de Gemini no está respondiendo correctamente"
                };
            }
        } catch (error) {
            return {
                success: false,
                message: `❌ Error al conectar con Gemini API: ${error.message}`
            };
        }
    }

    static verifyEnvironmentVariables(): VerificationResult[] {
        const requiredVars = [
            'GEMINI_API_KEY',
            'PUPPETEER_EXECUTABLE_PATH',
            'ENV',
            'PORT',
            'MONGODB_URI',
            'JWT_SECRET'
        ];

        const results: VerificationResult[] = [];

        requiredVars.forEach(varName => {
            if (!process.env[varName]) {
                results.push({
                    success: false,
                    message: `❌ ${varName} no está configurada`
                });
            } else {
                results.push({
                    success: true,
                    message: `✅ ${varName} configurada`
                });
            }
        });

        return results;
    }

    static verifyOptionalAPIs(): VerificationResult[] {
        const optionalVars = [
            'OPENWEATHERMAP_API_KEY',
            'SPEECHIFY_API_KEY',
            'ASSEMBLYAI_API_KEY'
        ];

        const results: VerificationResult[] = [];

        optionalVars.forEach(varName => {
            if (!process.env[varName]) {
                results.push({
                    success: true,
                    message: `⚠️  ${varName} no configurada (opcional)`
                });
            } else {
                results.push({
                    success: true,
                    message: `✅ ${varName} configurada`
                });
            }
        });

        return results;
    }

    static async runVerification(): Promise<void> {
        console.log("🧠 Verificando configuración de MullBot...\n");

        // Verificar variables de entorno obligatorias
        console.log("📋 Variables de entorno obligatorias:");
        const envResults = this.verifyEnvironmentVariables();
        envResults.forEach(result => {
            console.log(`  ${result.message}`);
        });

        console.log("\n📋 APIs opcionales:");
        const optionalResults = this.verifyOptionalAPIs();
        optionalResults.forEach(result => {
            console.log(`  ${result.message}`);
        });

        // Verificar API de Gemini
        console.log("\n🤖 Verificando API de Gemini:");
        const geminiResult = await this.verifyGeminiAPI();
        console.log(`  ${geminiResult.message}`);

        // Resumen
        const allResults = [...envResults, ...optionalResults, geminiResult];
        const successCount = allResults.filter(r => r.success).length;
        const totalCount = allResults.length;

        console.log(`\n📊 Resumen: ${successCount}/${totalCount} verificaciones exitosas`);

        if (successCount === totalCount) {
            console.log("\n🎉 ¡MullBot está listo para funcionar!");
            console.log("   Ejecuta: npm run dev");
            console.log("   Panel web: http://localhost:3000");
        } else {
            console.log("\n⚠️  Hay algunos problemas de configuración.");
            console.log("   Revisa el archivo README.md para más información.");
        }
    }
}

// Ejecutar verificación si se llama directamente
if (require.main === module) {
    MullBotVerifier.runVerification().catch(console.error);
}

export default MullBotVerifier;
