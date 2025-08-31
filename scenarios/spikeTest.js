export const spikeTest = {
    stages: [
      { duration: '5m', target: 1000 },
      { duration: '1m', target: 10000 },
      { duration: '5m', target: 10000 },
      { duration: '1m', target: 1000 },
      { duration: '1m', target: 10 },
    ],
  };
  