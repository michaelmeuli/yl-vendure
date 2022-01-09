import { LanguageCode } from '@vendure/common/lib/generated-types';
import { PaymentMethodHandler } from '@vendure/core';

/**
 * The handler for Swiss QR invoice payments.
 */
export const swissQrInvoice = new PaymentMethodHandler({
    code: 'swissqrinvoice',
    description: [{ languageCode: LanguageCode.en, value: 'Swissqrinvoice' }],
    args: {},

    async createPayment(ctx, order, amount, args, metadata) {
        return {
            amount: amount,
            state: 'Authorized' as const
        };
    },

    settlePayment() {
        return {
            success: true,
        };
    },

});
