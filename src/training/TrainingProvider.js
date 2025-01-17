import { logMessage } from '../utils/logger';

const MODELS_STATUS = {
    0: 'CREATED',
    1: 'IN_PROGRESS',
    2: 'ERRORED',
    3: 'COMPLETED',
    4: 'DELETED',
};

const TRANSACTIONS_MESSAGE = {
    GET_STATUS: '__get_model_status',
    GET_MODELS: '__get_existing_model',
    CREATE_MODEL: '__create_model',
    UPDATE_MODEL: '__update_model',
    DELETE_MODEL: '__delete_model',
};
class TrainingProvider {
    /**
     * Initializing the training provider
     * @param {Account} account
     * @param {URL} serviceEndpoint
     */
    constructor(account, serviceEndpoint) {
        this.account = account;
        this.TrainingModelProvider = undefined; //should be implemented as subclass
        this._modelServiceClient =
            this.TrainingModelProvider?._generateModelServiceClient(
                serviceEndpoint
            );
    }

    /**
     * Signing request
     * @param {string} address - The public address of account
     * @param {TRANSACTIONS_MESSAGE[transactionType]} message - message by transactions type, should start with __
     * @private
     */
    async _requestSignForModel(address, message) {
        const currentBlockNumber = await this.account.getCurrentBlockNumber();
        const signatureBytes = await this.account.signData(
            { t: 'string', v: message },
            { t: 'address', v: address },
            { t: 'uint256', v: currentBlockNumber }
        );

        return {
            currentBlockNumber,
            signatureBytes,
        };
    }

    /**
     * Initializing the training provider
     * @param {TRANSACTIONS_MESSAGE[transactionType]} message - message by transactions type, should start with __
     * @param {string} address - The public address of account
     * @returns {AuthorizationRequest}
     * @private
     */
    async _formAuthorizationRequest(message, address) {
        const { currentBlockNumber, signatureBytes } =
            await this._requestSignForModel(address, message);

        const AuthorizationRequest =
            this.TrainingModelProvider._getAuthorizationRequestMethodDescriptor();
        const authorizationRequest = new AuthorizationRequest();

        authorizationRequest.setCurrentBlock(Number(currentBlockNumber));
        authorizationRequest.setMessage(message);
        authorizationRequest.setSignature(signatureBytes);
        authorizationRequest.setSignerAddress(address);

        return authorizationRequest;
    }

    /**
     * Get the model status
     * @param {{address: string, modelId: string, grpcMethod: string, grpcServiceName: string}} params - The params for generate request
     * @public
     */
    async getModelStatus(params) {
        const request = await this._trainingStatusStateRequest(params);

        return new Promise((resolve, reject) => {
            this._modelServiceClient.get_model_status(
                request,
                (err, response) => {
                    if (err) {
                        reject(err);
                    } else {
                        const modelStatus = response.getStatus();
                        resolve(MODELS_STATUS[modelStatus]);
                    }
                }
            );
        });
    }

    /**
     * Generate request for getting the model status
     * @param {{address: string, modelId: string, grpcMethod: string, grpcServiceName: string}} params - The params for generate request
     * @private
     */
    async _trainingStatusStateRequest(params) {
        const message = TRANSACTIONS_MESSAGE.GET_STATUS;
        const authorizationRequest = await this._formAuthorizationRequest(
            message,
            params.address
        );

        const ModelStateRequest =
            this.TrainingModelProvider._getUpdateModelRequestMethodDescriptor();
        const modelStateRequest = new ModelStateRequest();

        const ModelDetailsRequest =
            this.TrainingModelProvider._getModelDetailsRequestMethodDescriptor();
        const modelDetailsRequest = new ModelDetailsRequest();

        modelDetailsRequest.setModelId(params.modelId);
        modelDetailsRequest.setGrpcMethodName(params.grpcMethod);
        modelDetailsRequest.setGrpcServiceName(params.grpcServiceName);

        modelStateRequest.setAuthorization(authorizationRequest);
        modelStateRequest.setUpdateModelDetails(modelDetailsRequest);
        return modelStateRequest;
    }

    /**
     * Get the existing models
     * @param {{grpcMethod: string, grpcServiceName: string, address: string}} params - The params for generate request
     * @public
     */
    async getExistingModel(params) {
        const request = await this._trainingStateRequest(params);
        request;

        return new Promise((resolve, reject) => {
            this._modelServiceClient.get_all_models(
                request,
                (err, response) => {
                    if (err) {
                        reject(err);
                    } else {
                        const modelDetails = response.getListOfModelsList();

                        const data = modelDetails.map((item) => {
                            return {
                                modelId: item.getModelId(),
                                methodName: item.getGrpcMethodName(),
                                serviceName: item.getGrpcServiceName(),
                                description: item.getDescription(),
                                status: item.getStatus(),
                                updatedDate: item.getUpdatedDate(),
                                addressList: item.getAddressListList(),
                                modelName: item.getModelName(),
                                publicAccess: item.getIsPubliclyAccessible(),
                                dataLink: item.getTrainingDataLink(),
                            };
                        });
                        resolve(data);
                    }
                }
            );
        });
    }

    /**
     * Generate request for getting the existing models
     * @param {{grpcMethod: string, grpcServiceName: string, address: string}} params - The params for generate request
     * @privat
     */
    async _trainingStateRequest(params) {
        const message = TRANSACTIONS_MESSAGE.GET_MODELS;
        const ModelStateRequest =
            this.TrainingModelProvider._getModelRequestMethodDescriptor();
        const modelStateRequest = new ModelStateRequest();
        modelStateRequest.setGrpcMethodName(params.grpcMethod);
        modelStateRequest.setGrpcServiceName(params.grpcServiceName);

        const authorizationRequest = await this._formAuthorizationRequest(
            message,
            params.address
        );

        modelStateRequest.setAuthorization(authorizationRequest);
        return modelStateRequest;
    }

    /**
     * Create new model
     * @param {{address: string, modelName: string, grpcMethod: string, grpcServiceName: string, description: string, publicAccess: boolean, accessAddressList: string[], dataLink: string, orgId: string, serviceId: string, groupId: string}} params - The params for generate request
     * @public
     */
    async createModel(params) {
        const request = await this._trainingCreateModel(address, params);
        return new Promise((resolve, reject) => {
            this._modelServiceClient.create_model(request, (err, response) => {
                logMessage('debug', 'TrainingProvider', `create model ${err} ${response}`)
                if (err) {
                    reject(err);
                } else {
                    const modelDetails = response.getModelDetails();

                    const data = {
                        modelId: modelDetails.getModelId(),
                        methodName: modelDetails.getGrpcMethodName(),
                        serviceName: modelDetails.getGrpcServiceName(),
                        description: modelDetails.getDescription(),
                        status: modelDetails.getStatus(),
                        updatedDate: modelDetails.getUpdatedDate(),
                        accessAddressList: modelDetails.getAddressListList(),
                        modelName: modelDetails.getModelName(),
                        publicAccess: modelDetails.getIsPubliclyAccessible(),
                        dataLink: modelDetails.getTrainingDataLink(),
                    };
                    resolve(data);
                }
            });
        });
    }

    /**
     * Generate request for creating new model
     * @param {{address: string, modelName: string, grpcMethod: string, grpcServiceName: string, description: string, publicAccess: boolean, accessAddressList: string[], dataLink: string, orgId: string, serviceId: string, groupId: string}} params - The params for generate request
     * @private
     */
    async _trainingCreateModel(params) {
        const message = TRANSACTIONS_MESSAGE.CREATE_MODEL;
        const ModelStateRequest =
            this.TrainingModelProvider._getCreateModelRequestMethodDescriptor();
        const modelStateRequest = new ModelStateRequest();

        const ModelDetailsRequest =
            this.TrainingModelProvider._getModelDetailsRequestMethodDescriptor();
        const modelDetailsRequest = new ModelDetailsRequest();

        const authorizationRequest = await this._formAuthorizationRequest(
            message,
            params.address
        );
        modelDetailsRequest.setModelName(params.modelName);
        modelDetailsRequest.setGrpcMethodName(params.grpcMethod);
        modelDetailsRequest.setGrpcServiceName(params.grpcServiceName);
        modelDetailsRequest.setDescription(params.description);
        modelDetailsRequest.setIsPubliclyAccessible(params.publicAccess);
        modelDetailsRequest.setAddressListList(params.accessAddressList);
        modelDetailsRequest.setTrainingDataLink(params.dataLink);

        modelDetailsRequest.setOrganizationId(params.orgId);
        modelDetailsRequest.setServiceId(params.serviceId);
        modelDetailsRequest.setGroupId(params.groupId);

        modelStateRequest.setAuthorization(authorizationRequest);
        modelStateRequest.setModelDetails(modelDetailsRequest);
        return modelStateRequest;
    }

    /**
     * Delete a model
     * @param {{address: string,modelId: string, grpcMethod: string, grpcServiceName: string}} params - The params for generate request
     * @public
     */
    async deleteModel(params) {
        const request = await this._trainingDeleteModel(params);
        return new Promise((resolve, reject) => {
            this._modelServiceClient.delete_model(request, (err, response) => {
                logMessage('debug', 'TrainingProvider', `delete model ${err} ${response}`)
                if (err) {
                    reject(err);
                } else {
                    resolve(response);
                }
            });
        });
    }

    /**
     * Generate request for deleting a model
     * @param {{address: string,modelId: string, grpcMethod: string, grpcServiceName: string}} params - The params for generate request
     * @private
     */
    async _trainingDeleteModel(params) {
        const message = TRANSACTIONS_MESSAGE.DELETE_MODEL;
        const authorizationRequest = await this._formAuthorizationRequest(
            message,
            params.address
        );

        const ModelStateRequest =
            this.TrainingModelProvider._getUpdateModelRequestMethodDescriptor();
        const modelStateRequest = new ModelStateRequest();

        const ModelDetailsRequest =
            this.TrainingModelProvider._getModelDetailsRequestMethodDescriptor();
        const modelDetailsRequest = new ModelDetailsRequest();

        modelDetailsRequest.setModelId(params.modelId);
        modelDetailsRequest.setGrpcMethodName(params.grpcMethod);
        modelDetailsRequest.setGrpcServiceName(params.grpcServiceName);

        modelStateRequest.setAuthorization(authorizationRequest);
        modelStateRequest.setUpdateModelDetails(modelDetailsRequest);
        return modelStateRequest;
    }

    /**
     * Update a model
     * @param {{address: string, modelName: string, modelId: string, grpcMethod: string, grpcServiceName: string, description: string, publicAccess: boolean, accessAddressList: string[], dataLink: string, orgId: string, serviceId: string, groupId: string}} params - The params for generate request
     * @public
     */
    async updateModel(params) {
        const request = await this._trainingUpdateModel(params);
        return new Promise((resolve, reject) => {
            this._modelServiceClient.update_model_access(
                request,
                (err, response) => {
                    logMessage('debug', 'TrainingProvider', `update model ${err} ${response}`)
                    if (err) {
                        reject(err);
                    } else {
                        resolve(response);
                    }
                }
            );
        });
    }

    /**
     * Generate request for updating a model
     * @param {{address: string, modelName: string, modelId: string, grpcMethod: string, grpcServiceName: string, description: string, publicAccess: boolean, accessAddressList: string[], dataLink: string, orgId: string, serviceId: string, groupId: string}} params - The params for generate request
     * @private
     */
    async _trainingUpdateModel(params) {
        const message = TRANSACTIONS_MESSAGE.UPDATE_MODEL;
        const ModelStateRequest =
            this.TrainingModelProvider._getUpdateModelRequestMethodDescriptor();
        const modelStateRequest = new ModelStateRequest();

        const ModelDetailsRequest =
            this.TrainingModelProvider._getModelDetailsRequestMethodDescriptor();
        const modelDetailsRequest = new ModelDetailsRequest();

        const authorizationRequest = await this._formAuthorizationRequest(
            message,
            params.address
        );

        modelDetailsRequest.setModelId(params.modelId);
        modelDetailsRequest.setGrpcMethodName(params.grpcMethod);
        modelDetailsRequest.setGrpcServiceName(params.grpcServiceName);

        modelDetailsRequest.setModelName(params.modelName);
        modelDetailsRequest.setDescription(params.description);
        modelDetailsRequest.setAddressListList(params.addressList);
        modelDetailsRequest.setIsPubliclyAccessible(params.publicAccess);
        modelDetailsRequest.setTrainingDataLink(params.dataLink);
        // modelDetailsRequest.setStatus(params.status);
        // modelDetailsRequest.setUpdatedDate(params.updatedDate);

        modelDetailsRequest.setOrganizationId(params.orgId);
        modelDetailsRequest.setServiceId(params.serviceId);
        modelDetailsRequest.setGroupId(params.groupId);

        modelStateRequest.setAuthorization(authorizationRequest);
        modelStateRequest.setUpdateModelDetails(modelDetailsRequest);
        return modelStateRequest;
    }
}

export default TrainingProvider;
