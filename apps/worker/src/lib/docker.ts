import Docker from "dockerode";

/**
 * Docker client instance
 * Connects to Docker daemon via socket or TCP
 */
export function createDockerClient(): Docker {
  const socketPath = process.env.DOCKER_SOCKET_PATH || "/var/run/docker.sock";

  return new Docker({
    socketPath,
  });
}

/**
 * Default Docker client instance
 */
export const docker = createDockerClient();
