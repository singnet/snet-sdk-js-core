import BigNumber from "bignumber.js";

export const serviceStatus = {
    0: "CREATED",
    1: "VALIDATING",
    2: "VALIDATED",
    3: "TRAINING",
    4: "READY_TO_USE", // After training is completed
    5: "ERRORED",
    6: "DELETED",
}

export const UNIFIED_SIGN_EXPIRY = new BigNumber(300); // blocks number after that unified sign is expiry

export const TRANSACTIONS_MESSAGE = {
    GET_MODEL: 'get_model',
    GET_ALL_MODELS: 'get_all_models',
    VALIDATE_MODEL_PRICE: 'validate_model_price',
    TRAIN_MODEL_PRICE: 'train_model_price',
    VALIDATE_MODEL: 'validate_model',
    UPLOAD_AND_VALIDATE: 'upload_and_validate',
    TRAIN_MODEL: 'train_model',
    CREATE_MODEL: 'create_model',
    UPDATE_MODEL: 'update_model',
    DELETE_MODEL: 'delete_model',
    UNIFIED_SIGN: 'unified'
};
