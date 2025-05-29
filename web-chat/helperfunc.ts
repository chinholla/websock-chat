import { DynamoDBClient, PutItemCommand, DeleteItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const dynamo = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME;

export async function handleConnect(event: APIGatewayProxyEvent, connectionId: string): Promise<APIGatewayProxyResult> {
    const item =  {
        connectionId: { S: connectionId ?? "" },
    };
    try { 
        await dynamo.send(new PutItemCommand({ TableName: TABLE_NAME, Item: item }));
        return {
            statusCode: 200,
            body: JSON.stringify("connected")
        };
    } catch (err) {
        console.log(err);
        return {
            statusCode: 400,
            body: JSON.stringify("failed to connect")
        };
    }
}

export async function handleRegister(event: APIGatewayProxyEvent, connectionId: string): Promise<APIGatewayProxyResult> {
    const { groupId: newGroup } = JSON.parse(event.body ?? '{}');
    const item =  {
        connectionId: { S: connectionId ?? "" },
        groupId: { S: newGroup }
    };
    try { 
        await dynamo.send(new PutItemCommand({ TableName: TABLE_NAME, Item: item }));
        return {
            statusCode: 200,
            body: JSON.stringify("group registered")
        };
    } catch (err) {
        console.log(err);
        return {
            statusCode: 400,
            body: JSON.stringify("failed to register group")
        };
    }
}

export async function handleDisconnect(connectionId: string): Promise<APIGatewayProxyResult> {
    try {
        await dynamo.send(new DeleteItemCommand({
            TableName: TABLE_NAME,
            Key: {
                connectionId: { S: connectionId ?? "" },
            }
        }));
        return {
            statusCode: 200,
            body: JSON.stringify("disconnected")
        };
    } catch (error) {
        console.log(error);
        return {
            statusCode: 500,
            body: JSON.stringify("failed to disconnect")
        }
    }
}

export async function handleSend(event: APIGatewayProxyEvent, clientAPI: ApiGatewayManagementApiClient): Promise<APIGatewayProxyResult> {
    const { groupId, message } = JSON.parse(event.body ?? '{}');
    const queryResult = await dynamo.send(new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'groupId-index',
        KeyConditionExpression: "groupId = :g",
        ExpressionAttributeValues: {
            ":g": {S: groupId }
        }
    }));
    const connections = queryResult.Items || [];
    if (connections.length === 0) {
        return {
            statusCode: 404,
            body: "no active connections in group"
        };
    }
    try {
        for (const item of connections) {
            const targetId = item.connectionId.S;
            await clientAPI.send(new PostToConnectionCommand({
                ConnectionId: targetId,
                Data: message
            }));
        }
        return {
            statusCode: 200,
            body: JSON.stringify("message sent")
        };
    } catch(error) {
        console.log(error);
        return {
            statusCode: 400,
            body: JSON.stringify(`failed to send message to group ${groupId}`)
        }
    }
}