import { useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import { WS_BASE_URL } from '../config/endpoints';

export const useSeatSocket = (
    tripId: number | undefined,
    onUpdate: (data: any) => void
) => {
    const onUpdateRef = useRef(onUpdate);

    useEffect(() => {
        onUpdateRef.current = onUpdate;
    }, [onUpdate]);

    useEffect(() => {
        if (!tripId) return;

        const wsUrl = WS_BASE_URL;
        const token = localStorage.getItem('accessToken');

        const client = new Client({
            brokerURL: wsUrl,
            connectHeaders: token ? { Authorization: `Bearer ${token}` } : undefined,
            reconnectDelay: 5000,
            onConnect: () => {
                console.log('STOMP Connected');
                client.subscribe(`/topic/trips/${tripId}/seats`, (message) => {
                    try {
                        onUpdateRef.current(JSON.parse(message.body));
                    } catch (err) {
                        console.error('Failed to parse STOMP message:', err);
                    }
                });
            },
            onStompError: (frame) => {
                console.error('STOMP Error:', frame.headers['message']);
            },
            onWebSocketClose: () => {
                console.log('WebSocket Closed');
            },
        });

        client.activate();

        return () => {
            client.deactivate();
        };
    }, [tripId]);
};
