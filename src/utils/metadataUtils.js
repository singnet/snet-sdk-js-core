export class MetadataGenerator {
    getMetadataFields(metadata) {
        return { type: { header: 'snet-payment-type', value: metadata.type } };
    }

    generateMetadata(metadata) {
        const generatedMetadata = [];
        const metadataFields = this.getMetadataFields(metadata);

        Object.keys(metadataFields).forEach((dataField) => {
            if (!metadata.hasOwnProperty(dataField)) {
                return;
            }
            const field = metadataFields[dataField];
            generatedMetadata.push({
                [field.header]: field.value,
            });
        });

        return generatedMetadata;
    }
}

export class PaymentMetadataGenerator extends MetadataGenerator {
    getMetadataFields(metadata) {
        return {
            ...super.getMetadataFields(metadata),
            channelId: {
                header: 'snet-payment-channel-id',
                value: metadata?.channelId,
            },
            channelNonce: {
                header: 'snet-payment-channel-nonce',
                value: metadata?.channelNonce,
            },
            channelAmount: {
                header: 'snet-payment-channel-amount',
                value: metadata?.channelAmount,
            },
            signatureBytes: {
                header: 'snet-payment-channel-signature-bin',
                value: metadata?.signatureBytes?.toString('base64'),
            },
        };
    }
}

export class TrainingPaymentMetadataGenerator extends PaymentMetadataGenerator {
    getMetadataFields(metadata) {
        return {
            ...super.getMetadataFields(metadata),
            modelId: {
                header: 'snet-train-model-id',
                value: metadata.modelId,
            },
        }
    }
}

export class PrepaidMetadataGenerator extends MetadataGenerator {
    getMetadataFields(metadata) {
        return {
            ...super.getMetadataFields(metadata),
            channelId: {
                header: 'snet-payment-channel-id',
                value: metadata?.channelId,
            },
            channelNonce: {
                header: 'snet-payment-channel-nonce',
                value: metadata?.channelNonce,
            },
            prepaidAuthTokenBytes: {
                header: 'snet-prepaid-auth-token-bin',
                value: metadata?.prepaidAuthTokenBytes?.toString('base64'),
            },
        };
    }
}

export class FreecallMetadataGenerator extends MetadataGenerator {
    getMetadataFields(metadata) {
        return {
            ...super.getMetadataFields(metadata),
            userId: {
                header: 'snet-free-call-user-id',
                value: metadata?.userId,
            },
            currentBlockNumber: {
                header: 'snet-current-block-number',
                value: metadata?.currentBlockNumber,
            },
            freecallAuthToken: {
                header: 'snet-free-call-auth-token-bin',
                value: metadata?.freecallAuthToken?.toString('base64'),
            },
            freecallTokenExpiryBlock: {
                header: 'snet-free-call-token-expiry-block',
                value: metadata?.freecallTokenExpiryBlock,
            },
            signatureBytes: {
                header: 'snet-payment-channel-signature-bin',
                value: metadata?.signatureBytes?.toString('base64'),
            },
        };
    }
}
