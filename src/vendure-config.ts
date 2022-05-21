import {
    dummyPaymentHandler,
    DefaultJobQueuePlugin,
    DefaultSearchPlugin,
    VendureConfig,
} from '@vendure/core';
import { defaultEmailHandlers, EmailPlugin } from '@vendure/email-plugin';
import { AssetServerPlugin, configureS3AssetStorage } from '@vendure/asset-server-plugin';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import path from 'path';
import { SwissQrInvoicePlugin } from './plugins/swiss-qr-invoice/swiss-qr-invoice-plugin';
import { emailHandlers } from './email-handlers';
import { StripePlugin } from '@vendure/payments-plugin/package/stripe';

export const config: VendureConfig = {
    apiOptions: {
        port: parseInt(<string>process.env.PORT) || 3000,
        adminApiPath: 'admin-api',
        adminApiPlayground: {
            settings: {
                'request.credentials': 'include',
            } as any,
        },// turn this off for production
        adminApiDebug: true, // turn this off for production
        shopApiPath: 'shop-api',
        shopApiPlayground: {
            settings: {
                'request.credentials': 'include',
            } as any,
        },// turn this off for production
        shopApiDebug: true,// turn this off for production
    },
    authOptions: {
        superadminCredentials: {
            identifier: <string>process.env.SUPERADMIN_IDENTIFIER,
            password: <string>process.env.SUPERADMIN_PASSWORD,
        },
        cookieOptions: {
          secret: process.env.COOKIE_SECRET || 'cookie-secret',
        },
        tokenMethod: 'bearer', // authorization header method
        requireVerification: false, // disable register by email verification
    },
    dbConnectionOptions: {
        type: 'postgres',
        synchronize: true, // turn this off for production
        logging: false,
        database: <string>process.env.DB_DATABASE,
        host: <string>process.env.DB_HOST,
        port: 5432,
        username: <string>process.env.DB_USERNAME,
        password: <string>process.env.DB_PASSWORD,
        migrations: [path.join(__dirname, '../migrations/*.ts')],
        // extra: { max: 2 } //  limit connections because of ElephantSQL
    },
    paymentOptions: {
        paymentMethodHandlers: [dummyPaymentHandler],
    },
    customFields: {},
    plugins: [
        AssetServerPlugin.init({
            route: 'assets',
            assetUploadDir: path.join(__dirname, '../static/assets'),
            storageStrategyFactory: configureS3AssetStorage({
                bucket: <string>process.env.AWS_BUCKET,
                credentials: {
                  accessKeyId: <string>process.env.AWS_ACCESS_KEY_ID,
                  secretAccessKey: <string>process.env.AWS_SECRET_ACCESS_KEY,
                },
              }),
        }),
        DefaultJobQueuePlugin.init({ useDatabaseForBuffer: true }),
        DefaultSearchPlugin.init({ bufferUpdates: false, indexStockStatus: true }),
        EmailPlugin.init({
            // devMode: true,
            // outputPath: path.join(__dirname, '../static/email/test-emails'),
            // route: 'mailbox',
            handlers: emailHandlers, // defaultEmailHandlers,
            templatePath: path.join(__dirname, '../static/email/templates'),
            globalTemplateVars: {
                // The following variables will change depending on your storefront implementation
                fromAddress: '"Yoga Lichtquelle" <no-reply@yoga-lichtquelle.ch>',
                verifyEmailAddressUrl: 'http://localhost:8080/verify',
                passwordResetUrl: 'http://localhost:8080/password-reset',
                changeEmailAddressUrl: 'http://localhost:8080/verify-email-address-change'
            },
            transport: {
                type: 'smtp',
                host: 'smtp.sendgrid.net',
                port: 465,
                secure: true, // true for 465, false for other ports
                auth: {
                    user: <string>process.env.SMTP_USER,
                    pass: <string>process.env.SMTP_PASSWORD
                }
            }
        }),
        AdminUiPlugin.init({
            route: 'admin',
            port: 3002,
        }),
        SwissQrInvoicePlugin,
        StripePlugin.init({
            apiKey: <string>process.env.STRIPE_SECRET_KEY,
            webhookSigningSecret: <string>process.env.STRIPE_WEBHOOK_SIGNING_SECRET,
            // This prevents different customers from using the same PaymentIntent
            storeCustomersInStripe: true,
          }),
    ],
};
