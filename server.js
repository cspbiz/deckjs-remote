var connect = require('connect'),
	socketio = require('socket.io'),
	server = connect.createServer(),
	io,
	decks = {},
	util = {
        url: require('url'),
        crypto: require('crypto')
	};

// set up server
server.use(connect.static(__dirname + '/public'));
server.listen(process.env.C9_PORT || 80);

// set up the socket
io = socketio.listen(server);

io.sockets.on('connection', function(client){
	client.on('join', function(data){
		var id = getIdFromUrl(data.url),
			deck = decks[id];
		
		if (!deck) {
			decks[id] = deck = defaultDeckState();
		}

		if (data.is_master) {
			setupMaster(client, deck);
		}
		else {
			setupViewer(client, deck);
		}
	});
});

function setupMaster(client, deck) {
	client.on('master', function(data){
		if (verifyKey(data.key, data.input)) {
			client.emit('master', true);
			deck.has_master = true;

			deck.viewers.forEach(function(viewer){
				viewer.emit('notify', { master: true });
			});

			client.on('change', function(data){
				deck.current = data.current;
				// notify viewers of change
				deck.viewers.forEach(function(viewer){
					viewer.emit('slide', deck.current);
				});
			});

			client.on('disconnect', function(){
				deck.has_master = false;
				deck.viewers.forEach(function(viewer){
					viewer.emit('notify', { master: false });
				});
			});
		}
		else {
			client.emit('master', false);
		}
			
	});
}

function setupViewer(client, deck) {
	if (deck.has_master) {
		client.emit('notify', {master: true, current: deck.current});
	}

	deck.viewers.push(client);

	client.on('disconnect', function(){
		deck.viewers.forEach(function(viewer, i){
			if (viewer == client) {
				deck.viewers.splice(i, 1);
			}
		});
	});
}

function getIdFromUrl(url) {
	var parsed = util.url.parse(url);
	console.log(parsed.hostname + parsed.pathname);
	return parsed.hostname + parsed.pathname;
}

function defaultDeckState() {
	return {
		current: 0,
		viewers: [],
		has_master: false
	};
}

function verifyKey(key, input) {
	return (key == util.crypto.createHash('md5').update(input).digest('hex'));
}