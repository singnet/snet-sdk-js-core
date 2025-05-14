import {serviceStatus, TRANSACTIONS_MESSAGE, UNIFIED_SIGN_EXPIRY} from '../constants/TrainingConstants';
import {logMessage} from '../utils/logger';
import fs from 'fs'
import path from "path";

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
        this._unifiedSigns = {};
    }

    async _requestSignForModel(address, message) {
        const currentBlockNumber = await this.account.getCurrentBlockNumber();
        const signatureBytes = await this.account.signData(
            { t: 'string', v: message },
            { t: 'address', v: address },
            { t: 'uint256', v: currentBlockNumber }
        );
        return {
            currentBlockNumber,
            signatureBytes
        };
    }

    async _getUnifiedSign(address) {
        const keyOfUnifiedSign = address;
        const blockNumber = await this.account.getCurrentBlockNumber();

        if (
            this._unifiedSigns[keyOfUnifiedSign] &&
            blockNumber - this._unifiedSigns[keyOfUnifiedSign].currentBlockNumber <= UNIFIED_SIGN_EXPIRY
        ) {
            return this._unifiedSigns[keyOfUnifiedSign];
        }
        const {
            currentBlockNumber,
            signatureBytes
        } = await this._requestSignForModel(address, TRANSACTIONS_MESSAGE.UNIFIED_SIGN);
        this._unifiedSigns[keyOfUnifiedSign] = {
            currentBlockNumber,
            signatureBytes
        };
        return {
            currentBlockNumber,
            signatureBytes
        };
    }

    _getAuthorizationRequest(currentBlockNumber, message, signatureBytes, address) {
        logMessage('debug', 'TrainingProvider', `creating authorization request ${message}`);
        const AuthorizationRequest = this.TrainingModelProvider._getAuthorizationRequestMethodDescriptor();
        const authorizationRequest = new AuthorizationRequest();

        authorizationRequest.setCurrentBlock(Number(currentBlockNumber));
        authorizationRequest.setMessage(message);
        authorizationRequest.setSignature(signatureBytes);
        authorizationRequest.setSignerAddress(address);
        return authorizationRequest;
    }

    async _getSignedAuthorizationRequest(address, message) {
        const {
            currentBlockNumber,
            signatureBytes
        } = await this._requestSignForModel(address, message);

        return this._getAuthorizationRequest(
            currentBlockNumber,
            message,
            signatureBytes,
            address
        );
    }

    async _getUnifiedAuthorizationRequest(address) {
        const {
            currentBlockNumber,
            signatureBytes
        } = await this._getUnifiedSign(address);

        return this._getAuthorizationRequest(
            currentBlockNumber,
            TRANSACTIONS_MESSAGE.UNIFIED_SIGN,
            signatureBytes,
            address
        );
    }

    async getMethodMetadata(params) {
        const request = this._getMethodMetadataRequest(params);

        return new Promise((resolve, reject) => {
            this._modelServiceClient.get_method_metadata(request, (err, response) => {
                if (err) {
                    logMessage('debug', 'TrainingProvider', `get_method_metadata ${err} ${response}`);
                    reject(err);
                } else {
                    const methodMetadata = {
                        defaultModelId: response.getDefaultModelId(),
                        maxModelsPerUser: response.getMaxModelsPerUser(),
                        datasetMaxSizeMb: response.getDatasetMaxSizeMb(),
                        datasetMaxCountFiles: response.getDatasetMaxCountFiles(),
                        datasetMaxSizeSingleFileMb: response.getDatasetMaxSizeSingleFileMb(),
                        datasetFilesType: response.getDatasetFilesType(),
                        datasetType: response.getDatasetType(),
                        datasetDescription: response.getDatasetDescription(),
                    };
                    resolve(methodMetadata);
                }
            });
        });
    }

    _getMethodMetadataRequest(params) {
        const ModelStateRequest = this.TrainingModelProvider._getMethodMetadataRequestMethodDescriptor();
        const modelStateRequest = new ModelStateRequest();

        if (params?.modelId) {
            modelStateRequest.setModelId(params.modelId);
            return modelStateRequest;
        }
        modelStateRequest.setGrpcMethodName(params.grpcMethod);
        modelStateRequest.setGrpcServiceName(params.serviceName);

        return modelStateRequest;
    }

    async getTrainingMetadata() {
        const request = this._trainingMetadataRequest();
        return new Promise((resolve, reject) => {
            this._modelServiceClient.get_training_metadata(request, (err, response) => {
                if (err) {
                    logMessage('debug', 'TrainingProvider', `get_training_metadata ${err} ${response}`);
                    reject(err);
                } else {
                    const parsedResponse = response.toObject();
                    resolve(parsedResponse);
                }
            });
        });
    }

    _trainingMetadataRequest() {
        const ModelStateRequest = this.TrainingModelProvider._getTrainingMetadataRequestMethodDescriptor();
        return new ModelStateRequest();
    }

    async getAllModels(params) {
        const request = await this._getAllModelsRequest(params);
        return new Promise((resolve, reject) => {
            this._modelServiceClient.get_all_models(request, (err, response) => {
                if (err) {
                    logMessage('debug', 'TrainingProvider', `get_all_models ${err} ${response}`);
                    reject(err);
                } else {
                    const modelDetails = response.getListOfModelsList();
                    const data = modelDetails.map(item => this._parseModelDetails(item));
                    resolve(data);
                }
            });
        });
    }

    _parseModelDetails(modelDetails) {
        return {
            modelId: modelDetails.getModelId(),
            methodName: modelDetails.getGrpcMethodName(),
            serviceName: modelDetails.getGrpcServiceName(),
            description: modelDetails.getDescription(),
            status: serviceStatus[modelDetails.getStatus()],
            updatedDate: modelDetails.getUpdatedDate(),
            accessAddressList: modelDetails.getAddressListList(),
            modelName: modelDetails.getName(),
            publicAccess: modelDetails.getIsPublic(),
            dataLink: modelDetails.getTrainingDataLink(),
            updatedByAddress: modelDetails.getUpdatedByAddress()
        };
    }

    async getModel(params) {
        const request = await this._getModelStatusRequest(params);

        return new Promise((resolve, reject) => {
            this._modelServiceClient.get_model(request, (err, response) => {
                    if (err) {
                        logMessage('debug', 'TrainingProvider', `get_model ${err} ${response}`);
                        reject(err);
                    } else {
                        const model = this._parseModelDetails(response);
                        resolve(model);
                    }
                }
            );
        });
    }

    async _getModelStatusRequest(params) {
        const message = TRANSACTIONS_MESSAGE.GET_MODEL;
        const authorizationRequest = params?.isUnifiedSign ?
            await this._getUnifiedAuthorizationRequest(params.address)
            : await this._getSignedAuthorizationRequest(params.address, message);

        const ModelStateRequest = this.TrainingModelProvider._getModelStatusRequestMethodDescriptor();
        const modelStateRequest = new ModelStateRequest();

        modelStateRequest.setAuthorization(authorizationRequest);
        modelStateRequest.setModelId(params.modelId);
        return modelStateRequest;
    }

    async getTrainModelPrice(params) {
        const request = await this._trainModelPriceRequest(params);
        return new Promise((resolve, reject) => {
            this._modelServiceClient.train_model_price(request, (err, response) => {
                if (err) {
                    logMessage('debug', 'TrainingProvider', `train_model_price ${err} ${response}`);
                    reject(err);
                } else {
                    const price = response.getPrice();
                    resolve(price);
                }
            });
        });
    }

    async _trainModelPriceRequest(params) {
        const message = TRANSACTIONS_MESSAGE.TRAIN_MODEL_PRICE;
        const authorizationRequest = params?.isUnifiedSign ?
            await this._getUnifiedAuthorizationRequest(params.address)
            : await this._getSignedAuthorizationRequest(params.address, message);

        const ModelStateRequest = this.TrainingModelProvider._getTrainModelPriceRequestMethodDescriptor();
        const modelStateRequest = new ModelStateRequest();

        modelStateRequest.setAuthorization(authorizationRequest);
        modelStateRequest.setModelId(params.modelId);
        return modelStateRequest;
    }

    async trainModel(params) {
        const amount = await this.getTrainModelPrice({...params, isUnifiedSign: true});
        const request = await this._trainModelRequest(params);
        const paymentMetadata = await this._generateTrainingPaymentMetadata(params.modelId, amount);

        return new Promise((resolve, reject) => {
            this._modelServiceClient.train_model(request, paymentMetadata, (err, response) => {
                if (err) {
                    logMessage('debug', 'TrainingProvider', `train_model ${err} ${response}`);
                    reject(err);
                } else {
                    const modelStatus = serviceStatus[response.getStatus()];
                    resolve(modelStatus);
                }
            });
        });
    }

    async _trainModelRequest(params) {
        const ModelStateRequest = this.TrainingModelProvider._getTrainModelRequestMethodDescriptor();
        const modelStateRequest = new ModelStateRequest();

        const message = TRANSACTIONS_MESSAGE.TRAIN_MODEL;
        const authorizationRequest = await this._getSignedAuthorizationRequest(params.address, message);

        modelStateRequest.setAuthorization(authorizationRequest);
        modelStateRequest.setModelId(params.modelId);

        return modelStateRequest;
    }

    async getValidateModelPrice(params) {
        const request = await this._validateModelPriceRequest(params);
        return new Promise((resolve, reject) => {
            this._modelServiceClient.validate_model_price(request, (err, response) => {
                if (err) {
                    logMessage('debug', 'TrainingProvider', `validate_model_price ${err} ${response}`);
                    reject(err);
                } else {
                    const price = response.getPrice();
                    resolve(price);
                }
            });
        });
    }

    async _validateModelPriceRequest(params) {
        const message = TRANSACTIONS_MESSAGE.VALIDATE_MODEL_PRICE;
        const authorizationRequest = params?.isUnifiedSign ?
            await this._getUnifiedAuthorizationRequest(params.address)
            : await this._getSignedAuthorizationRequest(params.address, message);

        const ModelStateRequest = this.TrainingModelProvider._getValidateModelPriceRequestMethodDescriptor();
        const modelStateRequest = new ModelStateRequest();

        modelStateRequest.setAuthorization(authorizationRequest);
        modelStateRequest.setModelId(params.modelId);
        modelStateRequest.setTrainingDataLink(params.trainingDataLink);

        return modelStateRequest;
    }

    async validateModel(params) {
        const amount = await this.getValidateModelPrice({...params, isUnifiedSign: true});
        const request = await this._validateModelRequest(params);
        const paymentMetadata = await this._generateTrainingPaymentMetadata(params.modelId, amount);

        return new Promise((resolve, reject) => {
            this._modelServiceClient.validate_model(request, paymentMetadata, (err, response) => {
                if (err) {
                    logMessage('debug', 'TrainingProvider', `validate_model ${err} ${response}`);
                    reject(err);
                } else {
                    const status = serviceStatus[response.getStatus()];
                    resolve(status);
                }
            });
        });
    }

    async _validateModelRequest(params) {
        const message = TRANSACTIONS_MESSAGE.VALIDATE_MODEL;
        const authorizationRequest = await this._getSignedAuthorizationRequest(params.address, message);

        const ModelStateRequest = this.TrainingModelProvider._getValidateModelRequestMethodDescriptor();
        const modelStateRequest = new ModelStateRequest();

        modelStateRequest.setAuthorization(authorizationRequest);
        modelStateRequest.setModelId(params.modelId);
        modelStateRequest.setTrainingDataLink(params.trainingDataLink);
        return modelStateRequest;
    }

    async _getAllModelsRequest(params) {
        const message = TRANSACTIONS_MESSAGE.GET_ALL_MODELS;
        const authorizationRequest = params?.isUnifiedSign ?
            await this._getUnifiedAuthorizationRequest(params.address)
            : await this._getSignedAuthorizationRequest(params.address, message);

        const ModelStateRequest = this.TrainingModelProvider._getAllModelsRequestMethodDescriptor();
        const modelStateRequest = new ModelStateRequest();

        modelStateRequest.setAuthorization(authorizationRequest);
        params?.statuses && params?.statuses.forEach(status => modelStateRequest.addStatuses(status));
        modelStateRequest.setIsPublic(params?.isPublic ? params.isPublic : null);
        modelStateRequest.setGrpcServiceName(params?.serviceName);
        modelStateRequest.setGrpcMethodName(params?.grpcMethod);
        modelStateRequest.setName(params.name);
        modelStateRequest.setCreatedByAddress(params?.createdByAddress);
        modelStateRequest.setPageSize(params?.pageSize);
        modelStateRequest.setPage(params?.page);

        return modelStateRequest;
    }

    async uploadAndValidateModel(params, filepath, methodMetadata) {
        const amount = await this.getValidateModelPrice({
            ...params,
            isUnifiedSign: true
        });
        const fileStats = fs.statSync(filepath);
        const fileName = path.basename(filepath);
        const fileExt = path.extname(fileName).substring(1);
        const fileData = fs.readFileSync(filepath);
        const fileSize = fileStats.size;
        const fileSizeMB = fileSize / (1024 * 1024);

        if (fileSizeMB > methodMetadata.datasetMaxSizeSingleFileMb) {
            throw new Error(`The file exceeds the allowed size: ${fileSizeMB}MB > ${methodMetadata.datasetMaxSizeSingleFileMb}MB`);
        }

        const allowedTypes = methodMetadata.datasetType.split(', ').map(ext => ext.trim());
        if (!allowedTypes.includes(fileExt)) {
            throw new Error(`Invalid file type: ${fileExt}. Allowed: ${allowedTypes.join(', ')}`);
        }
        const batchSize = 1024 * 1024;
        const batchCount = Math.ceil(fileSize / batchSize);
        const paymentMetadata = await this._generateTrainingPaymentMetadata(params.modelId, amount);
        const message = TRANSACTIONS_MESSAGE.UPLOAD_AND_VALIDATE;
        const authorizationRequest = await this._getSignedAuthorizationRequest(params.address, message);
        const UploadAndValidateModelRequest = this.TrainingModelProvider._getUploadAndValidateModelRequestMethodDescriptor();

        const UploadInput = this.TrainingModelProvider._getUploadInputMethodDescriptor()

        return new Promise((resolve, reject) => {
            let call;
            const fileStream = fs.createReadStream(filepath, {
                highWaterMark: batchSize
            });
            let batchNumber = 0;

            const baseRequest = new UploadAndValidateModelRequest();
            const baseUploadInput = new UploadInput();
            baseUploadInput.setModelId(params.modelId)
            baseUploadInput.setData(fileData)
            baseUploadInput.setFileName(fileName)
            baseUploadInput.setFileSize(fileSize)
            baseUploadInput.setBatchSize(batchSize)
            baseUploadInput.setBatchNumber(batchNumber)
            baseUploadInput.setBatchCount(batchCount)
            baseRequest.setUploadInput(baseUploadInput);
            baseRequest.setAuthorization(authorizationRequest);

            call = this._modelServiceClient.upload_and_validate(paymentMetadata, baseRequest, (err, response) => {
                if (err) {
                    console.error('Upload and validate error:', err);
                    return reject(err);
                }
                const status = serviceStatus[response.getStatus()];
                resolve(status);
            });
            fileStream.on('open', () => {
                console.log('The file stream is open');
            });
            fileStream.on('error', (err) => {
                console.error('File opening error:', err);
            });
            fileStream.on('end', () => {
                console.log('The file stream is complete');
                call.end();
            });
            fileStream.on('data', chunk => {
                batchNumber++;
                const chunkRequest = new UploadAndValidateModelRequest();
                const chunkUploadInput = new UploadInput();
                chunkUploadInput.setModelId(params.modelId)
                chunkUploadInput.setData(chunk)
                chunkUploadInput.setFileName(fileName)
                chunkUploadInput.setFileSize(fileSize)
                chunkUploadInput.setBatchSize(batchSize)
                chunkUploadInput.setBatchNumber(batchNumber)
                chunkUploadInput.setBatchCount(batchCount)
                chunkRequest.setUploadInput(baseUploadInput);
                chunkRequest.setAuthorization(authorizationRequest);
                call.write(chunkRequest);
                console.log(`Chunk number ${batchNumber}/${batchCount} has been sent – ${chunk.length} bytes`);
            });
        });
    }

    async createModel(params) {
        const request = await this._createModelRequest(params);
        return new Promise((resolve, reject) => {
            this._modelServiceClient.create_model(request, (err, response) => {
                logMessage('debug', 'TrainingProvider', `create model ${err} ${response}`);
                if (err) {
                    reject(err);
                } else {
                    const data = {
                        addressList: response.getAddressListList(),
                        description: response.getDescription(),
                        isPublic: response.getIsPublic(),
                        modelId: response.getModelId(),
                        modelName: response.getName(),
                        status: serviceStatus[response.getStatus()],
                        updatedDate: response.getUpdatedDate(),
                        serviceName: response.getGrpcServiceName(),
                        methodName: response.getGrpcMethodName()
                    };
                    resolve(data);
                }
            });
        });
    }

    async _createModelRequest(params) {
        const message = TRANSACTIONS_MESSAGE.CREATE_MODEL;
        const authorizationRequest = await this._getSignedAuthorizationRequest(params.address, message);

        const ModelStateRequest = this.TrainingModelProvider._getCreateModelRequestMethodDescriptor();
        const modelStateRequest = new ModelStateRequest();

        const NewModelRequest = this.TrainingModelProvider._getNewModelRequestMethodDescriptor();
        const newModelRequest = new NewModelRequest();

        newModelRequest.setName(params.modelName);
        newModelRequest.setGrpcMethodName(params.grpcMethod);
        newModelRequest.setGrpcServiceName(params.serviceName);
        newModelRequest.setDescription(params.description);
        newModelRequest.setIsPublic(params.isPublic);
        newModelRequest.setAddressListList(params.addressList);
        modelStateRequest.setAuthorization(authorizationRequest);
        modelStateRequest.setModel(newModelRequest);
        return modelStateRequest;
    }

    async deleteModel(params) {
        const request = await this._deleteModelRequest(params);
        return new Promise((resolve, reject) => {
            this._modelServiceClient.delete_model(request, (err, response) => {
                logMessage('debug', 'TrainingProvider', `delete model ${err} ${response}`);
                if (err) {
                    reject(err);
                } else {
                    const status = serviceStatus[response.getStatus()];
                    resolve(status);
                }
            });
        });
    }

    async _deleteModelRequest(params) {
        const message = TRANSACTIONS_MESSAGE.DELETE_MODEL;
        const authorizationRequest = await this._getSignedAuthorizationRequest(params.address, message);

        const ModelStateRequest = this.TrainingModelProvider._getDeleteModelRequestMethodDescriptor();
        const modelStateRequest = new ModelStateRequest();

        modelStateRequest.setAuthorization(authorizationRequest);
        modelStateRequest.setModelId(params.modelId);
        return modelStateRequest;
    }

    async updateModel(params) {
        const request = await this._updateModelRequest(params);
        return new Promise((resolve, reject) => {
            this._modelServiceClient.update_model(request, (err, response) => {
                logMessage('debug', 'TrainingProvider', `update model ${err} ${response}`);
                if (err) {
                    reject(err);
                } else {
                    const updatedModel = this._parseModelDetails(response)
                    resolve(updatedModel);
                }
            });
        });
    }

    async _updateModelRequest(params) {
        const message = TRANSACTIONS_MESSAGE.UPDATE_MODEL;
        const authorizationRequest = await this._getSignedAuthorizationRequest(params.address, message);

        const ModelStateRequest = this.TrainingModelProvider._getUpdateModelRequestMethodDescriptor();
        const modelStateRequest = new ModelStateRequest();

        modelStateRequest.setAuthorization(authorizationRequest);
        modelStateRequest.setModelId(params.modelId);

        if (params.modelName) {
            modelStateRequest.setModelName(params.modelName);
        }

        if (params.description) {
            modelStateRequest.setDescription(params.description);
        }

        if (params.addressList && Array.isArray(params.addressList)) {
            modelStateRequest.setAddressListList(params.addressList);
        }

        return modelStateRequest;
    }

    _generateTrainingPaymentMetadata() {
        logger.error('_generateTrainingPaymentMetadata must be implemented in the sub classes');
    }

}

export default TrainingProvider;
