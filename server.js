import handler from 'serve-handler';
import http from 'http';

const server = http.createServer((request, response) => {
  return handler(request, response, {
    public: '.',
    rewrites: [
      { source: '/node_modules/*', destination: '/node_modules/*' }
    ]
  });
});

server.listen(3000, () => {
  console.log('Running at http://localhost:3000');
}); 