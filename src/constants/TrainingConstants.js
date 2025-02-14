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
    GET_MODEL_STATE: '__get',
    GET_MODELS: '__get',
    VALIDATE_MODEL_PRICE: '__get',
    TRAIN_MODEL_PRICE: '__get',
    VALIDATE_MODEL: '__validate_model',
    TRAIN_MODEL: '__train_model',
    CREATE_MODEL: '__create_model',
    UPDATE_MODEL: '__update_model',
    DELETE_MODEL: '__delete_model',
};
