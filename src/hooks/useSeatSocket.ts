import { useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';

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

        const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/api/v1/ws';
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
