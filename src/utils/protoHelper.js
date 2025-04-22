/**
 * helper function to simplify calls of grpc. Now you can simply use it with try catch block
 * @param {*} remoteProcedure 
 * @param {*} requestMessage 
 * @param {*} metadata 
 * @returns { Promise }
 */
export function wrapRpcToPromise(remoteProcedure, requestMessage, metadata) {
  return new Promise((resolve, reject) => {
    remoteProcedure(requestMessage, metadata, (error, responseMessage) => {
      if(error) {
        reject(error);
      } else {
        resolve(responseMessage);
      }
    })
  })
}