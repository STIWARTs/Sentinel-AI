import { useEffect, useState } from 'react';

export function useWebSocket(url) {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!url) {
      return undefined;
    }

    const socket = new WebSocket(url);
    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);

    return () => socket.close();
  }, [url]);

  return connected;
}
