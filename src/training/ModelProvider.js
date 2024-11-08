class ModelProvider {
    constructor(serviceClient, modelServiceClient) {
        this._serviceClient = serviceClient;
        this._modelServiceClient = modelServiceClient;
    }

    async getExistingModel(params) {
        const request = await this._trainingStateRequest(params);
        return new Promise((resolve, reject) => {
            this._modelServiceClient.get_all_models(
                request,
                (err, response) => {
                    const modelDetails = response.getListOfModelsList();
                    const data = modelDetails.map((item) => ({
                        modelId: item.getModelId(),
                        methodName: item.getGrpcMethodName(),
                        serviceName: item.getGrpcServiceName(),
                        description: item.getDescription(),
                        status: item.getStatus(),
                        updatedDate: item.getUpdatedDate(),
                        addressList: item.getAddressListList(),
                        modelName: item.getModelName(),
                        publicAccess: item.getIsPubliclyAccessible(),
                    }));
                    if (err) {
                        reject(err);
                    } else {
                        resolve(data);
                    }
                }
            );
        });
    }

    async createAuthorizationRequest(address, message) {
        try {
            const { currentBlockNumber, signatureBytes } =
                await this._requestSignForModel(address, message);

            const AuthorizationRequest =
                this._serviceClient._getAuthorizationRequestMethodDescriptor();
            const authorizationRequest = new AuthorizationRequest();

            authorizationRequest.setCurrentBlock(currentBlockNumber);
            authorizationRequest.setMessage(message);
            authorizationRequest.setSignature(signatureBytes);
            authorizationRequest.setSignerAddress(address);
            return authorizationRequest;
        } catch (error) {
            throw new Error('creating authorization request error: ', error);
        }
    }

    async _trainingStateRequest(params) {
        try {
            const message = '__get_existing_model';
            const ModelStateRequest = this._serviceClient._getModelRequestMethodDescriptor();
            const modelStateRequest = new ModelStateRequest();

            const authorizationRequest = await this.createAuthorizationRequest(
                params.address,
                message
            );
            modelStateRequest.setAuthorization(authorizationRequest);
            modelStateRequest.setGrpcMethodName(params.grpcMethod);
            modelStateRequest.setGrpcServiceName(params.grpcService);
            return modelStateRequest;
        } catch (error) {
            throw new Error('getting training model state error: ', error);
        }
    }

    async _requestSignForModel(address, message) {
        try {
            const currentBlockNumber = await this._serviceClient.getCurrentBlockNumber();
            const signatureBytes = await this._serviceClient.signData(
                { t: 'string', v: message },
                { t: 'address', v: address },
                { t: 'uint256', v: currentBlockNumber }
            );

            return {
                currentBlockNumber,
                signatureBytes,
            };
        } catch (error) {
            throw new Error('requesting sign for model error: ', error);
        }
    }

    async createModel(address, params) {
        try {
            const request = await this._trainingCreateModel(address, params);
            return new Promise((resolve, reject) => {
                this._modelServiceClient.create_model(
                    request,
                    (err, response) => {
                        debug(`create model ${err} ${response}`);
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
                            publicAccess:
                                modelDetails.getIsPubliclyAccessible(),
                        };
                        if (err) {
                            reject(err);
                        } else {
                            resolve(data);
                        }
                    }
                );
            });
        } catch (error) {
            throw new Error('creating model error: ', error);
        }
    }

    async _trainingCreateModel(address, params) {
        try {
            const message = '__create_model';
            const ModelStateRequest =
                this._serviceClient._getCreateModelRequestMethodDescriptor();
            const modelStateRequest = new ModelStateRequest();
            const ModelDetailsRequest =
                this._serviceClient._getModelDetailsRequestMethodDescriptor();

            const { orgId, serviceId, groupId } = this._serviceClient.getServiceDetails();
            const modelDetailsRequest = new ModelDetailsRequest();
            const authorizationRequest = await this.createAuthorizationRequest(
                address,
                message
            );

            modelDetailsRequest.setModelName(params.modelName);
            modelDetailsRequest.setGrpcMethodName(params.method);
            modelDetailsRequest.setGrpcServiceName(params.serviceName);
            modelDetailsRequest.setDescription(params.description);
            modelDetailsRequest.setIsPubliclyAccessible(params.publicAccess);
            modelDetailsRequest.setAddressListList(params.address);
            modelDetailsRequest.setTrainingDataLink('');

            modelDetailsRequest.setOrganizationId(orgId);
            modelDetailsRequest.setServiceId(serviceId);
            modelDetailsRequest.setGroupId(groupId);

            modelStateRequest.setAuthorization(authorizationRequest);
            modelStateRequest.setModelDetails(modelDetailsRequest);
            return modelStateRequest;
        } catch (error) {
            throw new Error('creating training model error: ', error);
        }
    }

    async deleteModel(params) {
        try {
            const request = await this._trainingDeleteModel(params);
            return new Promise((resolve, reject) => {
                this._modelServiceClient.delete_model(
                    request,
                    (err, response) => {
                        // debug(`delete model ${err} ${response}`);
                        if (err) {
                            reject(err);
                        } else {
                            resolve(response);
                        }
                    }
                );
            });
        } catch (error) {
            throw new Error('deleting training model error: ', error);
        }
    }

    async _trainingDeleteModel(params) {
        try {
            const message = '__delete_model';

            const ModelStateRequest =
                this._serviceClient._getUpdateModelRequestMethodDescriptor();
            const modelStateRequest = new ModelStateRequest();

            const ModelDetailsRequest =
                this._serviceClient._getModelDetailsRequestMethodDescriptor();
            const modelDetailsRequest = new ModelDetailsRequest();

            const authorizationRequest = await this.createAuthorizationRequest(
                params.address,
                message
            );

            modelDetailsRequest.setModelId(params.modelId);
            modelDetailsRequest.setGrpcMethodName(params.method);
            modelDetailsRequest.setGrpcServiceName(params.name);

            modelStateRequest.setAuthorization(authorizationRequest);
            modelStateRequest.setUpdateModelDetails(modelDetailsRequest);
            return modelStateRequest;
        } catch (error) {
            throw new Error('deleting training model error: ', error);
        }
    }

    async updateModel(params) {
        try {
            const request = await this._trainingUpdateModel(params);
            return new Promise((resolve, reject) => {
                this._modelServiceClient.update_model_access(
                    request,
                    (err, response) => {
                        // debug(`update model ${err} ${response}`);
                        if (err) {
                            reject(err);
                        } else {
                            resolve(response);
                        }
                    }
                );
            });
        } catch (error) {
            throw new Error('updating training model error: ', error);
        }
    }

    async _trainingUpdateModel(params) {
        try {
            const message = '__update_model';

            const ModelStateRequest =
                this._serviceClient._getUpdateModelRequestMethodDescriptor();
            const modelStateRequest = new ModelStateRequest();

            const ModelDetailsRequest =
                this._serviceClient._getModelDetailsRequestMethodDescriptor();
            const modelDetailsRequest = new ModelDetailsRequest();

            const authorizationRequest = await this.createAuthorizationRequest(
                params.address,
                message
            );

            modelDetailsRequest.setModelId(params.modelId);
            modelDetailsRequest.setGrpcMethodName(params.method);
            modelDetailsRequest.setGrpcServiceName(params.name);
            modelDetailsRequest.setModelName(params.modelName);
            modelDetailsRequest.setDescription(params.description);
            modelDetailsRequest.setAddressListList(params.addressList);
            modelDetailsRequest.setTrainingDataLink('');
            modelDetailsRequest.setStatus(params.status);
            modelDetailsRequest.setUpdatedDate(params.updatedDate);
            modelDetailsRequest.setIsPubliclyAccessible(params.publicAccess);

            const { orgId, serviceId, groupId } = this.getServiceDetails();
            modelDetailsRequest.setOrganizationId(orgId);
            modelDetailsRequest.setServiceId(serviceId);
            modelDetailsRequest.setGroupId(groupId);

            modelStateRequest.setAuthorization(authorizationRequest);
            modelStateRequest.setUpdateModelDetails(modelDetailsRequest);
            return modelStateRequest;
        } catch (error) {
            throw new Error(
                'getting updating training model request error: ',
                error
            );
        }
    }
}

export default ModelProvider;
