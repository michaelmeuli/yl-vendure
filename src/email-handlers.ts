/* tslint:disable:no-non-null-assertion */
import {
    PaymentStateTransitionEvent,
    AccountRegistrationEvent,
    IdentifierChangeRequestEvent,
    NativeAuthenticationMethod,
    OrderStateTransitionEvent,
    PasswordResetEvent,
    ShippingMethod,
    TransactionalConnection,
} from '@vendure/core';
import { EmailEventHandler, EmailEventListener } from '@vendure/email-plugin';
import { Stream, Writable } from "stream";

const fs = require('fs');
const os = require('os');
const path = require('path');
const SwissQRBill = require('swissqrbill');

// let dir_home = os.homedir();
const date = new Date();

export const sendInvoiceHandler = new EmailEventListener('send-invoice')
    .on(PaymentStateTransitionEvent)
    .filter(
        event =>
            event.toState === 'Authorized' &&
            event.payment.method === 'swissqrinvoice' &&
            !!event.order.customer,
    )
    .loadData(async context => {
        const taxIncluded = (context.event.order.totalWithTax - context.event.order.total) / 100;
        const data = {
            currency: 'CHF',
            amount: context.event.order.totalWithTax / 100,
            additionalInformation: context.event.order.code,
            creditor: {
                name: 'Jessica Meuli',
                address: 'Sonnenhaldenstrasse 5',
                zip: 8360,
                city: 'Wallenwil',
                account: 'CH14 0078 1612 4519 5200 2',
                country: 'CH',
                mwst: 'UID: CHE-154.780.687',
            },
            debtor: {
                name: context.event.order.shippingAddress.fullName,
                address: context.event.order.shippingAddress.streetLine1,
                zip: context.event.order.shippingAddress.postalCode,
                city: context.event.order.shippingAddress.city,
                country: context.event.order.shippingAddress.countryCode,
            },
        };

        const writableStream: Writable = new Stream.Writable();
        writableStream._write = (chunk, encoding, next) => { next() }
        const pdf = new SwissQRBill.PDF(data, writableStream, { autoGenerate: false, size: 'A4' });

        //-- Add creditor address
        pdf.fontSize(12);
        pdf.fillColor('black');
        pdf.font('Helvetica');
        pdf.text(
            data.creditor.name +
                '\n' +
                data.creditor.address +
                '\n' +
                data.creditor.zip +
                ' ' +
                data.creditor.city +
                '\n' +
                data.creditor.mwst,
            SwissQRBill.utils.mm2pt(20),
            SwissQRBill.utils.mm2pt(35),
            {
                width: SwissQRBill.utils.mm2pt(100),
                height: SwissQRBill.utils.mm2pt(50),
                align: 'left',
            },
        );

        //-- Add debtor address
        pdf.fontSize(12);
        pdf.font('Helvetica');
        pdf.text(
            data.debtor.name + '\n' + data.debtor.address + '\n' + data.debtor.zip + ' ' + data.debtor.city,
            SwissQRBill.utils.mm2pt(130),
            SwissQRBill.utils.mm2pt(60),
            {
                width: SwissQRBill.utils.mm2pt(70),
                height: SwissQRBill.utils.mm2pt(50),
                align: 'left',
            },
        );

        //-- Add title
        pdf.fontSize(14);
        pdf.font('Helvetica-Bold');
        pdf.text(
            'Rechnung zur Bestellung: ' + context.event.order.code,
            SwissQRBill.utils.mm2pt(20),
            SwissQRBill.utils.mm2pt(100),
            {
                width: SwissQRBill.utils.mm2pt(170),
                align: 'left',
            },
        );
        pdf.fontSize(11);
        pdf.font('Helvetica');
        pdf.text('Wallenwil ' + date.getDate() + '.' + (date.getMonth() + 1) + '.' + date.getFullYear(), {
            width: SwissQRBill.utils.mm2pt(170),
            align: 'right',
        });

        //-- Add table
        const orderlines = [];
        context.event.order.lines;
        for (let [i, v] of context.event.order.lines.entries()) {
            orderlines.push({
                columns: [
                    {
                        text: i + 1,
                        width: SwissQRBill.utils.mm2pt(20),
                    },
                    {
                        text: v.quantity,
                        width: SwissQRBill.utils.mm2pt(20),
                    },
                    {
                        text: v.productVariant.name,
                    },
                    {
                        text: Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(
                            v.linePriceWithTax / 100,
                        ),
                        width: SwissQRBill.utils.mm2pt(30),
                    },
                ],
            });
        }
        const table = {
            width: SwissQRBill.utils.mm2pt(170),
            rows: [
                {
                    height: 30,
                    fillColor: '#ECF0F1',
                    columns: [
                        {
                            text: 'Position',
                            width: SwissQRBill.utils.mm2pt(20),
                        },
                        {
                            text: 'Anzahl',
                            width: SwissQRBill.utils.mm2pt(20),
                        },
                        {
                            text: 'Bezeichnung',
                        },
                        {
                            text: 'Total',
                            width: SwissQRBill.utils.mm2pt(30),
                        },
                    ],
                },
                ...orderlines,
                {
                    height: 40,
                    columns: [
                        {
                            text: '',
                            width: SwissQRBill.utils.mm2pt(20),
                        },
                        {
                            text: '',
                            width: SwissQRBill.utils.mm2pt(20),
                        },
                        {
                            text: 'Versandkosten',
                        },
                        {
                            text: Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(
                                context.event.order.shippingWithTax / 100,
                            ),
                            width: SwissQRBill.utils.mm2pt(30),
                        },
                    ],
                },
                {
                    height: 40,
                    columns: [
                        {
                            text: '',
                            width: SwissQRBill.utils.mm2pt(20),
                        },
                        {
                            text: '',
                            width: SwissQRBill.utils.mm2pt(20),
                        },
                        {
                            text: 'Rechnungstotal',
                            font: 'Helvetica-Bold',
                        },
                        {
                            text: Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(
                                context.event.order.totalWithTax / 100,
                            ),
                            font: 'Helvetica-Bold',
                            width: SwissQRBill.utils.mm2pt(30),
                        },
                    ],
                },
                {
                    columns: [
                        {
                            text: '',
                            width: SwissQRBill.utils.mm2pt(20),
                        },
                        {
                            text: '',
                            width: SwissQRBill.utils.mm2pt(20),
                        },
                        {
                            text: '',
                        },
                        {
                            text: '',
                            width: SwissQRBill.utils.mm2pt(30),
                        },
                    ],
                },
            ],
        };
        pdf.addTable(table);

        pdf.addQRBill();
        pdf.end();
        return { pdf, taxIncluded };
    })
    .setAttachments(async event => {
        return [
            {
                filename: event.order.code + '.pdf',
                content: event.data.pdf,
            },
        ];
    })
    .setRecipient(event => event.order.customer!.emailAddress)
    .setOptionalAddressFields(() => ({ bcc: 'michael.meuli@gmail.com, yoga.lichtquelle@gmail.com' }))
    .setFrom(`{{ fromAddress }}`)
    .setSubject(`Rechnung für Bestellung #{{ order.code }}`)
    .setTemplateVars(event => ({ order: event.order, date: date, taxIncluded: event.data.taxIncluded }));

export const orderConfirmationHandler = new EmailEventListener('order-confirmation')
    .on(OrderStateTransitionEvent)
    .filter(
        event =>
            event.toState === 'PaymentSettled' && event.fromState !== 'Modifying' && !!event.order.customer,
    )
    .loadData(async context => {
        const taxIncluded = (context.event.order.totalWithTax - context.event.order.total) / 100;
        return { taxIncluded };
    })
    .setRecipient(event => event.order.customer!.emailAddress)
    .setOptionalAddressFields(() => ({ bcc: 'michael.meuli@gmail.com, yoga.lichtquelle@gmail.com' }))
    .setFrom(`{{ fromAddress }}`)
    .setSubject(`Bestellbestätigung für #{{ order.code }}`)
    .setTemplateVars(event => ({ order: event.order, date: date, taxIncluded: event.data.taxIncluded  }));

export const emailVerificationHandler = new EmailEventListener('email-verification')
    .on(AccountRegistrationEvent)
    .filter(event => !!event.user.getNativeAuthenticationMethod().identifier)
    .filter(event => {
        const nativeAuthMethod = event.user.authenticationMethods.find(
            m => m instanceof NativeAuthenticationMethod,
        ) as NativeAuthenticationMethod | undefined;
        return (nativeAuthMethod && !!nativeAuthMethod.identifier) || false;
    })
    .setRecipient(event => event.user.identifier)
    .setFrom(`{{ fromAddress }}`)
    .setSubject(`E-Mail-Adresse bestätigen`)
    .setTemplateVars(event => ({
        verificationToken: event.user.getNativeAuthenticationMethod().verificationToken,
    }));

export const passwordResetHandler = new EmailEventListener('password-reset')
    .on(PasswordResetEvent)
    .setRecipient(event => event.user.identifier)
    .setFrom(`{{ fromAddress }}`)
    .setSubject(`Passwort zurücksetzen`)
    .setTemplateVars(event => ({
        passwordResetToken: event.user.getNativeAuthenticationMethod().passwordResetToken,
    }));

export const emailAddressChangeHandler = new EmailEventListener('email-address-change')
    .on(IdentifierChangeRequestEvent)
    .setRecipient(event => event.user.getNativeAuthenticationMethod().pendingIdentifier!)
    .setFrom(`{{ fromAddress }}`)
    .setSubject(`Neue E-Mail-Adresse bestätigen`)
    .setTemplateVars(event => ({
        identifierChangeToken: event.user.getNativeAuthenticationMethod().identifierChangeToken,
    }));

export const emailHandlers: Array<EmailEventHandler<any, any>> = [
    sendInvoiceHandler,
    orderConfirmationHandler,
    emailVerificationHandler,
    passwordResetHandler,
    emailAddressChangeHandler,
];
