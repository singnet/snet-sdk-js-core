class TrainingProvider {
    constructor(modelServiceClient) {
        this._modelServiceClient = modelServiceClient;
    }

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
                        resolve(modelStatus);
                    }
                }
            );
        });
    }

    async _trainingStatusStateRequest(params) {
        const message = '__get_model_status';
        const { currentBlockNumber, signatureBytes } =
            await this._requestSignForModel(params.address, message);

        const ModelStateRequest = this._getUpdateModelRequestMethodDescriptor();
        const modelStateRequest = new ModelStateRequest();

        const ModelDetailsRequest =
            this._getModelDetailsRequestMethodDescriptor();
        const modelDetailsRequest = new ModelDetailsRequest();

        modelDetailsRequest.setModelId(params.modelId);
        modelDetailsRequest.setGrpcMethodName(params.method);
        modelDetailsRequest.setGrpcServiceName(params.name);

        const AuthorizationRequest =
            this._getAuthorizationRequestMethodDescriptor();
        const authorizationRequest = new AuthorizationRequest();

        authorizationRequest.setCurrentBlock(Number(currentBlockNumber));
        authorizationRequest.setMessage(message);
        authorizationRequest.setSignature(signatureBytes);
        authorizationRequest.setSignerAddress(params.address);

        modelStateRequest.setAuthorization(authorizationRequest);
        modelStateRequest.setUpdateModelDetails(modelDetailsRequest);
        return modelStateRequest;
    }

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

    async _trainingStateRequest(params) {
        const message = '__get_existing_model';
        const { currentBlockNumber, signatureBytes } =
            await this._requestSignForModel(params.address, message);
        const ModelStateRequest = this._getModelRequestMethodDescriptor();
        const modelStateRequest = new ModelStateRequest();
        modelStateRequest.setGrpcMethodName(params.grpcMethod);
        modelStateRequest.setGrpcServiceName(params.grpcService);

        const AuthorizationRequest =
            this._getAuthorizationRequestMethodDescriptor();
        const authorizationRequest = new AuthorizationRequest();

        authorizationRequest.setCurrentBlock(Number(currentBlockNumber));
        authorizationRequest.setMessage(message);
        authorizationRequest.setSignature(signatureBytes);
        authorizationRequest.setSignerAddress(params.address);

        modelStateRequest.setAuthorization(authorizationRequest);
        return modelStateRequest;
    }

    async _requestSignForModel(address, message) {
        const currentBlockNumber = await this._web3.eth.getBlockNumber();
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

    async createModel(address, params) {
        const request = await this._trainingCreateModel(address, params);
        return new Promise((resolve, reject) => {
            this._modelServiceClient.create_model(request, (err, response) => {
                logger.debug(`create model ${err} ${response}`);
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
                        addressList: modelDetails.getAddressListList(),
                        modelName: modelDetails.getModelName(),
                        publicAccess: modelDetails.getIsPubliclyAccessible(),
                        dataLink: modelDetails.getTrainingDataLink(),
                    };
                    resolve(data);
                }
            });
        });
    }

    async _trainingCreateModel(address, params) {
        const message = '__create_model';
        const { currentBlockNumber, signatureBytes } =
            await this._requestSignForModel(address, message);
        const ModelStateRequest = this._getCreateModelRequestMethodDescriptor();
        const modelStateRequest = new ModelStateRequest();

        const AuthorizationRequest =
            this._getAuthorizationRequestMethodDescriptor();
        const authorizationRequest = new AuthorizationRequest();
        const ModelDetailsRequest =
            this._getModelDetailsRequestMethodDescriptor();

        const { orgId, serviceId, groupId } = this.getServiceDetails();
        const modelDetailsRequest = new ModelDetailsRequest();
        authorizationRequest.setCurrentBlock(Number(currentBlockNumber));
        authorizationRequest.setMessage(message);
        authorizationRequest.setSignature(signatureBytes);
        authorizationRequest.setSignerAddress(address);

        modelDetailsRequest.setModelName(params.modelName);
        modelDetailsRequest.setGrpcMethodName(params.method);
        modelDetailsRequest.setGrpcServiceName(params.serviceName);
        modelDetailsRequest.setDescription(params.description);
        modelDetailsRequest.setIsPubliclyAccessible(params.publicAccess);
        modelDetailsRequest.setAddressListList(params.address);
        modelDetailsRequest.setTrainingDataLink(params.dataLink);

        modelDetailsRequest.setOrganizationId(orgId);
        modelDetailsRequest.setServiceId(serviceId);
        modelDetailsRequest.setGroupId(groupId);

        modelStateRequest.setAuthorization(authorizationRequest);
        modelStateRequest.setModelDetails(modelDetailsRequest);
        return modelStateRequest;
    }

    async deleteModel(params) {
        const request = await this._trainingDeleteModel(params);
        return new Promise((resolve, reject) => {
            this._modelServiceClient.delete_model(request, (err, response) => {
                logger.debug(`delete model ${err} ${response}`);
                if (err) {
                    reject(err);
                } else {
                    resolve(response);
                }
            });
        });
    }

    async _trainingDeleteModel(params) {
        const message = '__delete_model';
        const { currentBlockNumber, signatureBytes } =
            await this._requestSignForModel(params.address, message);

        const ModelStateRequest = this._getUpdateModelRequestMethodDescriptor();
        const modelStateRequest = new ModelStateRequest();

        const AuthorizationRequest =
            this._getAuthorizationRequestMethodDescriptor();
        const authorizationRequest = new AuthorizationRequest();
        const ModelDetailsRequest =
            this._getModelDetailsRequestMethodDescriptor();
        const modelDetailsRequest = new ModelDetailsRequest();

        authorizationRequest.setCurrentBlock(Number(currentBlockNumber));
        authorizationRequest.setMessage(message);
        authorizationRequest.setSignature(signatureBytes);
        authorizationRequest.setSignerAddress(params.address);
        modelDetailsRequest.setModelId(params.modelId);
        modelDetailsRequest.setGrpcMethodName(params.method);
        modelDetailsRequest.setGrpcServiceName(params.name);

        modelStateRequest.setAuthorization(authorizationRequest);
        modelStateRequest.setUpdateModelDetails(modelDetailsRequest);
        return modelStateRequest;
    }

    async updateModel(params) {
        const request = await this._trainingUpdateModel(params);
        return new Promise((resolve, reject) => {
            this._modelServiceClient.update_model_access(
                request,
                (err, response) => {
                    logger.debug(`update model ${err} ${response}`);
                    if (err) {
                        reject(err);
                    } else {
                        resolve(response);
                    }
                }
            );
        });
    }

    async _trainingUpdateModel(params) {
        const message = '__update_model';
        const { currentBlockNumber, signatureBytes } =
            await this._requestSignForModel(params.address, message);

        const ModelStateRequest = this._getUpdateModelRequestMethodDescriptor();
        const modelStateRequest = new ModelStateRequest();

        const AuthorizationRequest =
            this._getAuthorizationRequestMethodDescriptor();
        const authorizationRequest = new AuthorizationRequest();
        const ModelDetailsRequest =
            this._getModelDetailsRequestMethodDescriptor();
        const modelDetailsRequest = new ModelDetailsRequest();

        authorizationRequest.setCurrentBlock(Number(currentBlockNumber));
        authorizationRequest.setMessage(message);
        authorizationRequest.setSignature(signatureBytes);
        authorizationRequest.setSignerAddress(params.address);
        modelDetailsRequest.setModelId(params.modelId);
        modelDetailsRequest.setGrpcMethodName(params.method);
        modelDetailsRequest.setGrpcServiceName(params.name);
        modelDetailsRequest.setModelName(params.modelName);
        modelDetailsRequest.setDescription(params.description);
        modelDetailsRequest.setAddressListList(params.addressList);
        modelDetailsRequest.setStatus(params.status);
        modelDetailsRequest.setUpdatedDate(params.updatedDate);
        modelDetailsRequest.setIsPubliclyAccessible(params.publicAccess);
        modelDetailsRequest.setTrainingDataLink(params.dataLink);

        const { orgId, serviceId, groupId } = this.getServiceDetails();
        modelDetailsRequest.setOrganizationId(orgId);
        modelDetailsRequest.setServiceId(serviceId);
        modelDetailsRequest.setGroupId(groupId);

        modelStateRequest.setAuthorization(authorizationRequest);
        modelStateRequest.setUpdateModelDetails(modelDetailsRequest);
        return modelStateRequest;
    }
}

export default TrainingProvider;
