import { io } from 'socket.io-client';

let socket = null;

export const getGroupSocket = () => {
  if (!socket) {
    socket = io(`${process.env.EXPO_PUBLIC_WS_URL}/groups`, {
      transports: ['websocket'],
      autoConnect: false,
    });
  }
  return socket;
};

export const disconnectGroupSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
