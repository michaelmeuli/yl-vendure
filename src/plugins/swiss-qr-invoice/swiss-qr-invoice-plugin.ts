import { PluginCommonModule, VendurePlugin } from '@vendure/core';

import { swissQrInvoice } from './swiss-qr-invoice-payment-method';

/**
 * This plugin implements the payment via the new swiss qr bill (https://www.six-group.com/de/newsroom/media-releases/2020/20200609-qr-bill-launch.html).
 * With SwissQRBill you can easily generate the new QR Code payment slips in Node.js and the browser: https://github.com/schoero/SwissQRBill 
 */
@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [],
    configuration: config => {
        config.paymentOptions.paymentMethodHandlers.push(swissQrInvoice);
        return config;
    }
})
export class SwissQrInvoicePlugin {}
