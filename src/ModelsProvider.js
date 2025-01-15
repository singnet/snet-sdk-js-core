import { logMessage } from "./utils/logger";

export class ChannelModelProvider {
    generatePaymentChannelStateServiceClient() {
        logMessage('error', 'ChannelModelProvider', '_generatePaymentChannelStateServiceClient must be implemented in the sub classes');
    }

    getChannelStateRequestMethodDescriptor() {
        logMessage('error', 'ChannelModelProvider', '_getChannelStateRequestMethodDescriptor must be implemented in the sub classes');
    }
}

export class TrainingModelProvider {
    getModelRequestMethodDescriptor() {
        logMessage('error', 'TrainingModelProvider', '_getModelRequestMethodDescriptor must be implemented in the sub classes');
    }

    getAuthorizationRequestMethodDescriptor() {
        logMessage('error', 'TrainingModelProvider', '_getAuthorizationRequestMethodDescriptor must be implemented in the sub classes');
    }

    getCreateModelRequestMethodDescriptor() {
        logMessage('error', 'TrainingModelProvider', '_getCreateModelRequestMethodDescriptor must be implemented in the sub classes');
    }

    getDeleteModelRequestMethodDescriptor() {
        logMessage('error', 'TrainingModelProvider', '_getDeleteModelRequestMethodDescriptor must be implemented in the sub classes');
    }

    getUpdateModelRequestMethodDescriptor() {
        logMessage('error', 'TrainingModelProvider', '__getUpdateModelRequestMethodDescriptor must be implemented in the sub classes');
    }

    getModelDetailsRequestMethodDescriptor() {
        logMessage('error', 'TrainingModelProvider', '_getModelDetailsRequestMethodDescriptor must be implemented in the sub classes');
    }
}
