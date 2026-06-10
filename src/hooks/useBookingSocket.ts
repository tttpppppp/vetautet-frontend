import { useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import { BookingResponse } from '../types/api.types';
import { WS_BASE_URL } from '../config/endpoints';

export const useBookingSocket = (
    userId: number | undefined,
    onBooking: (booking: BookingResponse) => void
) => {
    const onBookingRef = useRef(onBooking);

    useEffect(() => {
        onBookingRef.current = onBooking;
    }, [onBooking]);

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
                        onBookingRef.current(JSON.parse(message.body));
                    } catch (err) {
                        console.error('Failed to parse booking socket message:', err);
                    }
                };

                client.subscribe(`/topic/users/${userId}/bookings`, handleMessage);
                client.subscribe('/user/queue/bookings', handleMessage);
            },
            onStompError: (frame) => {
                console.error('Booking STOMP Error:', frame.headers['message']);
            },
        });

        client.activate();

        return () => {
            client.deactivate();
        };
    }, [userId]);
};
