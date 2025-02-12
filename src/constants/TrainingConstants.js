export const serviceStatus = {
    0: "CREATED",
    1: "VALIDATING",
    2: "VALIDATED",
    3: "TRAINING",
    4: "READY_TO_USE", // After training is completed
    5: "ERRORED",
    6: "DELETED",
}

export const UNIFIED_SIGN_EXPIRY = 300; // blocks number after that unified sign is expiry

export const TRANSACTIONS_MESSAGE = {
    GET_MODEL_STATE: '__get',
    GET_MODELS: '__get_existing_model',
    VALIDATE_MODEL: '__validate_model',
    VALIDATE_MODEL_PRICE: '__validate_model_price',
    TRAIN_MODEL: '__train_model',
    TRAIN_MODEL_PRICE: '__train_model_price',
    CREATE_MODEL: '__create_model',
    UPDATE_MODEL: '__update_model',
    DELETE_MODEL: '__delete_model',
};
