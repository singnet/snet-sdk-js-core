export class ChannelModelProvider {
    generatePaymentChannelStateServiceClient() {
        error(
            '_generatePaymentChannelStateServiceClient must be implemented in the sub classes'
        );
    }

    getChannelStateRequestMethodDescriptor() {
        error(
            'getChannelStateRequestMethodDescriptor must be implemented in the sub classes'
        );
    }
}

export class TrainingModelProvider {
    getModelRequestMethodDescriptor() {
        error(
            '_getModelRequestMethodDescriptor must be implemented in the sub classes'
        );
    }

    getAuthorizationRequestMethodDescriptor() {
        error(
            '_getAuthorizationRequestMethodDescriptor must be implemented in the sub classes'
        );
    }

    getCreateModelRequestMethodDescriptor() {
        error(
            '_getCreateModelRequestMethodDescriptor must be implemented in the sub classes'
        );
    }

    getDeleteModelRequestMethodDescriptor() {
        error(
            '_getDeleteModelRequestMethodDescriptor must be implemented in the sub classes'
        );
    }

    getUpdateModelRequestMethodDescriptor() {
        error(
            '__getUpdateModelRequestMethodDescriptor must be implemented in the sub classes'
        );
    }

    getModelDetailsRequestMethodDescriptor() {
        error(
            '_getModelDetailsRequestMethodDescriptor must be implemented in the sub classes'
        );
    }
}
