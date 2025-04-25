const OK_CODE = 0;
/**
 * helper function to simplify calls of grpc. Now you can simply use it with try catch block
 * @param {*} serviceClient
 * @param {string} remoteProcedureName
 * @param {*} requestMessage
 * @param {*} [metadata]
 * @returns { Promise }
 */
export function wrapRpcToPromise(serviceClient, remoteProcedureName, requestMessage, metadata) {
  return new Promise((resolve, reject) => {
    serviceClient[remoteProcedureName](requestMessage, metadata,
      (error, responseMessage) => {
        if (error) {
          reject(error);
        } else {
          resolve(responseMessage);
        }
      }
    );
  });
}

function wrapUnaryToPromiseOnEnd(response, resolve, reject) {
    const { message, status, statusMessage } = response;
    if (status !== OK_CODE) {
        const error = new Error(statusMessage);
        error.details = response;
        reject(error);
    }

    resolve(message);
}
export function wrapUnaryToPromise(serviceClient, methodDescriptor, props) {
  return new Promise((resolve, reject) => {
    props = {
      ...props,
      onEnd: (response) => wrapUnaryToPromiseOnEnd(response, resolve, reject),
    };
    serviceClient.unary(methodDescriptor, props);
  });
}
