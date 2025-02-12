import { UNIFIED_SIGN_EXPIRY, TRANSACTIONS_MESSAGE, serviceStatus } from '../constants/TrainingConstants';
import { logMessage } from '../utils/logger';

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

    async _getUnifiedSign(address, message) {
        const keyOfUnofiedSign = address + message;
        const blockNumber = await this._web3.eth.getBlockNumber();
        if(
            this.unifiedSigns[keyOfUnofiedSign] &&
            blockNumber - this.unifiedSigns[keyOfUnofiedSign]?.currentBlockNumber <= UNIFIED_SIGN_EXPIRY
        ) {
          return this.unifiedSigns[keyOfUnofiedSign];
        }
        const {
          currentBlockNumber,
          signatureBytes
        } = await this._requestSignForModel(address, message);
        this.unifiedSigns[keyOfUnofiedSign] = {
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
  
      async getMethodMetadata(params) {
          const request = this._methodMetadataRequest(params);
  
          return new Promise((resolve, reject) => {
            this._trainingServiceClient.get_method_metadata(request, (err, response) => {
              if(err) {
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
  
      _methodMetadataRequest(params) {
          const ModelStateRequest = this.TrainingModelProvider._getMethodMetadataRequestMethodDescriptor();
          const modelStateRequest = new ModelStateRequest();
  
          if(params?.modelId) {
              modelStateRequest.setModelId(params.modelId);
              return modelStateRequest;
          }
          modelStateRequest.setGrpcMethodName(params.grpcMethod);
          modelStateRequest.setGrpcServiceName(params.serviceName);
  
          return modelStateRequest;
      }
  
      async getServiceMetadata() {
        const request = this._trainingMetadataRequest();
        return new Promise((resolve, reject) => {
          this._trainingServiceClient.get_training_metadata(request, (err, response) => {
            if(err) {
                logMessage('debug', 'TrainingProvider', `get_training_metadata ${err} ${response}`);
                reject(err);
            } else {
              const trainingmethodsMap = response.getTrainingmethodsMap().map_;
              const methodsMapKeys = Object.keys(trainingmethodsMap);
              const trainingServicesAndMethods = {};
  
              methodsMapKeys.forEach(methodsMapKey => {
                  let trainingMethods = [];
                  trainingmethodsMap[methodsMapKey].value.map(methodsArray => 
                      methodsArray.forEach(methods => 
                          methods.forEach(method => {
                              if(String(method)) {
                              trainingMethods.push(method);
                              }
                          })
                      )
                  );
                  trainingServicesAndMethods[methodsMapKey] = trainingMethods;
              });
  
              const isTrainingEnabled = response.getTrainingenabled();
              const hasTrainingInProto = response.getTraininginproto();
              resolve({
                isTrainingEnabled,
                hasTrainingInProto,
                trainingServicesAndMethods
              });
            }
          });
        });
      }
  
      _trainingMetadataRequest() {
        const ModelStateRequest = this.TrainingModelProvider._getTrainingMetadataRequestMethodDescriptor();
        const modelStateRequest = new ModelStateRequest();
        return modelStateRequest;
      }
  
      async getAllModels(params) {
        const request = await this._trainingStateRequest(params);
        return new Promise((resolve, reject) => {
          this._trainingServiceClient.get_all_models(request, (err, response) => {
            if(err) {
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
          const request = await this._trainingGetModelStateRequest(params);
    
            return new Promise((resolve, reject) => {
                this._trainingServiceClient.get_model(request, (err, response) => {
                        if(err) {
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
  
      async getModelStatus(params) {
        const request = await this._trainingGetModelStateRequest(params);
  
          return new Promise((resolve, reject) => {
              this._trainingServiceClient.get_model( request, (err, response) => {
                      if(err) {
                        logMessage('debug', 'TrainingProvider', `get_model_status ${err} ${response}`);
                          reject(err);
                      } else {
                          const modelStatus = serviceStatus[response.getStatus()];
                          resolve(modelStatus);
                      }
                  }
              );
          });
      }
  
      async _trainingGetModelStateRequest(params) {
        const message = TRANSACTIONS_MESSAGE.GET_MODEL_STATE;
        const {
          currentBlockNumber,
          signatureBytes
        } = await this._getUnifiedSign(params.address, message);
  
        const ModelStateRequest = this.TrainingModelProvider._getModelStatusRequestMethodDescriptor();
        const modelStateRequest = new ModelStateRequest();
  
        const authorizationRequest = 
            this._getAuthorizationRequest(currentBlockNumber, message, signatureBytes, params.address);
  
        modelStateRequest.setAuthorization(authorizationRequest);
        modelStateRequest.setModelId(params.modelId);
        return modelStateRequest;
      }
  
      async getTrainModelPrice(params) {
          const request = await this._trainModelPriceRequest(params);
          return new Promise((resolve, reject) => {
            this._trainingServiceClient.train_model_price(request, (err, response) => {
              if(err) {
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
          const {
            currentBlockNumber,
            signatureBytes
          } = await this._getUnifiedSign(params.address, message);
          const ModelStateRequest = this.TrainingModelProvider._getTrainModelPriceRequestMethodDescriptor();
          const modelStateRequest = new ModelStateRequest();
        
          const authorizationRequest = 
            this._getAuthorizationRequest(currentBlockNumber, message, signatureBytes, params.address);

          modelStateRequest.setAuthorization(authorizationRequest);
          modelStateRequest.setModelId(params.modelId);
          return modelStateRequest;
      }
  
      async trainModel(params) {
          const request = await this._trainModelRequest(params);
          const amount = await this.getTrainModelPrice(params);
          const paymentMetadata = await this._generateTrainingPaymentMetadata(params.modelId, amount);
  
          return new Promise((resolve, reject) => {
            this._trainingServiceClient.train_model(request, paymentMetadata, (err, response) => {
              if(err) {
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
          const message = TRANSACTIONS_MESSAGE.TRAIN_MODEL;
          const {
            currentBlockNumber,
            signatureBytes
          } = await this._requestSignForModel(params.address, message);
  
          const ModelStateRequest = this.TrainingModelProvider._getTrainModelRequestMethodDescriptor();
          const modelStateRequest = new ModelStateRequest();
  
          const authorizationRequest = 
            this._getAuthorizationRequest(currentBlockNumber, message, signatureBytes, params.address);

          modelStateRequest.setAuthorization(authorizationRequest);
          modelStateRequest.setModelId(params.modelId);
  
          return modelStateRequest;
      }
  
      async getValidateModelPrice(params) {
        const request = await this._validateModelPriceRequest(params);
        return new Promise((resolve, reject) => {
          this._trainingServiceClient.validate_model_price(request, (err, response) => {
            if(err) {
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
        const {
          currentBlockNumber,
          signatureBytes
        } = await this._getUnifiedSign(params.address, message);
        const authorizationRequest = 
            this._getAuthorizationRequest(currentBlockNumber, message, signatureBytes, params.address);
  
        const ModelStateRequest = this.TrainingModelProvider._getValidateModelPriceRequestMethodDescriptor();
        const modelStateRequest = new ModelStateRequest();
        
        modelStateRequest.setAuthorization(authorizationRequest);
        modelStateRequest.setModelId(params.modelId);
        modelStateRequest.setTrainingDataLink(params.trainingDataLink);
  
        return modelStateRequest;
      }
  
      async validateModel(params) {
        const request = await this._validateModelRequest(params);
  
        const amount = await this.getValidateModelPrice(params);
        const paymentMetadata = await this._generateTrainingPaymentMetadata(params.modelId, amount);
  
        return new Promise((resolve, reject) => {
          this._trainingServiceClient.validate_model(request, paymentMetadata, (err, response) => {
            if(err) {
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
        const {
          currentBlockNumber,
          signatureBytes
        } = await this._requestSignForModel(params.address, message);
        const ModelStateRequest = this.TrainingModelProvider._getValidateModelRequestMethodDescriptor();
        const modelStateRequest = new ModelStateRequest();
        
        const authorizationRequest = 
            this._getAuthorizationRequest(currentBlockNumber, message, signatureBytes, params.address);
          
        modelStateRequest.setAuthorization(authorizationRequest);
        modelStateRequest.setModelId(params.modelId);
        modelStateRequest.setTrainingDataLink(params.trainingDataLink);
        return modelStateRequest;
      }
  
      async _trainingStateRequest(params) {
        const message = TRANSACTIONS_MESSAGE.GET_MODELS;
        const {
          currentBlockNumber,
          signatureBytes
        } = await this._requestSignForModel(params.address, message);
        const ModelStateRequest = this.TrainingModelProvider._getAllModelRequestMethodDescriptor();
        const modelStateRequest = new ModelStateRequest();
        
        const authorizationRequest = 
            this._getAuthorizationRequest(currentBlockNumber, message, signatureBytes, params.address);
        
        modelStateRequest.setAuthorization(authorizationRequest);
        params?.statuses.forEach(status => modelStateRequest.addStatuses(status));
        modelStateRequest.setIsPublic(params?.isPublic ? params.isPublic : null);
        modelStateRequest.setGrpcServiceName(params?.serviceName);
        modelStateRequest.setGrpcMethodName(params?.grpcMethod);
        modelStateRequest.setName(params.name);
        modelStateRequest.setCreatedByAddress(params?.createdByAddress);
        modelStateRequest.setPageSize(params?.pageSize);
        modelStateRequest.setPage(params?.page);
  
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
          signatureBytes
        };
      }
  
      async createModel(params) {
        const request = await this._trainingCreateModel(params);
        return new Promise((resolve, reject) => {
          this._trainingServiceClient.create_model(request, (err, response) => {
            logMessage('debug', 'TrainingProvider', `create model ${err} ${response}`);
            if(err) {
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
  
      async _trainingCreateModel(params) {
        const message = TRANSACTIONS_MESSAGE.CREATE_MODEL;
        const {
          currentBlockNumber,
          signatureBytes
        } = await this._getUnifiedSign(params.address, message);
        const ModelStateRequest = this.TrainingModelProvider._getCreateModelRequestMethodDescriptor();
        const modelStateRequest = new ModelStateRequest();

        const NewModelRequest = this.TrainingModelProvider._getNewModelRequestMethodDescriptor();
        const newModelRequest = new NewModelRequest();

        const authorizationRequest = 
            this._getAuthorizationRequest(currentBlockNumber, message, signatureBytes, params.address);

        newModelRequest.setName(params.name);
        newModelRequest.setGrpcMethodName(params.grpcMethod);
        newModelRequest.setGrpcServiceName(params.serviceName);
        newModelRequest.setDescription(params.description);
        newModelRequest.setIsPublic(params.is_public);
        newModelRequest.setAddressListList(params.address_list);
        modelStateRequest.setAuthorization(authorizationRequest);
        modelStateRequest.setModel(newModelRequest);
        return modelStateRequest;
      }
  
      async deleteModel(params) {
        const request = await this._trainingDeleteModel(params);
        return new Promise((resolve, reject) => {
          this._trainingServiceClient.delete_model(request, (err, response) => {
            logMessage('debug', 'TrainingProvider', `delete model ${err} ${response}`);
            if(err) {
              reject(err);
            } else {
              const status = serviceStatus[response.getStatus()];
              resolve(status);
            }
          });
        });
      }
  
      async _trainingDeleteModel(params) {
        const message = TRANSACTIONS_MESSAGE.DELETE_MODEL;
        const {
          currentBlockNumber,
          signatureBytes
        } = await this._requestSignForModel(params.address, message);
        const ModelStateRequest = this.TrainingModelProvider._getDeleteModelRequestMethodDescriptor();
        const modelStateRequest = new ModelStateRequest();
  
        const authorizationRequest = 
            this._getAuthorizationRequest(currentBlockNumber, message, signatureBytes, params.address);
  
        modelStateRequest.setAuthorization(authorizationRequest);
        modelStateRequest.setModelId(params.modelId);
        return modelStateRequest;
      }
  
      async updateModel(params) {
        const request = await this._trainingUpdateModel(params);
        return new Promise((resolve, reject) => {
          this._trainingServiceClient.update_model(request, (err, response) => {
            logMessage('debug', 'TrainingProvider', `update model ${err} ${response}`);
            if(err) {
              reject(err);
            } else {
              const updatedModel = this._parseModelDetails(response)
              resolve(updatedModel);
            }
          });
        });
      }
  
      async _trainingUpdateModel(params) {
        const message = TRANSACTIONS_MESSAGE.UPDATE_MODEL;
        const {
          currentBlockNumber,
          signatureBytes
        } = await this._requestSignForModel(params.address, message);
        const authorizationRequest = 
            this._getAuthorizationRequest(currentBlockNumber, message, signatureBytes, params.address);
  
        const ModelStateRequest = this.TrainingModelProvider._getUpdateModelRequestMethodDescriptor();
        const modelStateRequest = new ModelStateRequest();
        
        modelStateRequest.setAuthorization(authorizationRequest);
        modelStateRequest.setModelName(params.modelName);
        modelStateRequest.setModelId(params.modelId);
        modelStateRequest.setDescription(params.description);
        modelStateRequest.addAddressList(params.addressList);
  
        return modelStateRequest;
      }  
}

export default TrainingProvider;
