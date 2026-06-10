import { useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import { UserNotification } from '../types/api.types';
import { WS_BASE_URL } from '../config/endpoints';

export const useNotificationSocket = (
    userId: number | undefined,
    onNotification: (notification: UserNotification) => void
) => {
    const onNotificationRef = useRef(onNotification);

    useEffect(() => {
        onNotificationRef.current = onNotification;
    }, [onNotification]);

    useEffect(() => {
        if (!userId) return;

        const wsUrl = WS_BASE_URL;
        const token = localStorage.getItem('accessToken');

        const client = new Client({
            brokerURL: wsUrl,
            connectHeaders: token ? { Authorization: `Bearer ${token}` } : undefined,
            reconnectDelay: 5000,
            onConnect: () => {
                const handleMessage = (message: { body: string }) => {
                    try {
                        onNotificationRef.current(JSON.parse(message.body));
                    } catch (err) {
                        console.error('Failed to parse notification message:', err);
                    }
                };

                client.subscribe(`/topic/users/${userId}/notifications`, handleMessage);
                client.subscribe('/user/queue/notifications', handleMessage);
            },
            onStompError: (frame) => {
                console.error('Notification STOMP Error:', frame.headers['message']);
            },
        });

        client.activate();

        return () => {
            client.deactivate();
        };
    }, [userId]);
};
