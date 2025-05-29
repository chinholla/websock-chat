import { ApiGatewayManagementApiClient } from '@aws-sdk/client-apigatewaymanagementapi';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { handleConnect, handleRegister, handleDisconnect, handleSend } from './helperfunc'

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const connectionId = event.requestContext.connectionId as string;
    const routeKey = event.requestContext.routeKey;
    const domain = event.requestContext.domainName;
    const stage = event.requestContext.stage;

    const clientAPI = new ApiGatewayManagementApiClient({
        endpoint: `https://${domain}/${stage}`
    });

    try {
        switch (routeKey) {
            case '$connect':
                return await handleConnect(event, connectionId ?? "");
            case 'register':
                return await handleRegister(event, connectionId ?? "");
            case '$disconnect':
                return await handleDisconnect(connectionId ?? "");
            case 'send':
                return await handleSend(event, clientAPI);
            case '$default':
                return {
                    statusCode: 200,
                    body: JSON.stringify("hit default route due to improper action")
                }
            default:
                return {
                    statusCode: 400, 
                    body: JSON.stringify("Unsupported route"),
                    headers: { "Content-Type": "application/json" },
                }
        }  
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify("Internal Server Error"),
        };
    }
};
