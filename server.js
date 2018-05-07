//Dependencies
var express = require('express'); // Express dołączony dla potrzeb routingu
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http); // socket io dołączamy jako node'owy moduł 

// Obsługa index.html
app.get("/", function (request, response) {
  response.sendFile(__dirname + '/index.html'); 
});

// Obsługa folderu assetów
app.use('/assets',express.static('assets'))

// Nasłuchiwanie na 5000
app.set('port', (process.env.PORT || 5000));
http.listen(app.get('port'), function(){
  console.log('listening on port',app.get('port'));
});

var players = {}; //Tablica graczy identyfikowanych po socket id
var ball_array = []; // Tablica do śledzenia pocisków 
// Włączamy akceptowanie połączeń
io.on('connection', function(socket){
	// Nasłuchiwanie nowych graczy
	socket.on('new-player',function(state){
		console.log("New player joined with state:",state);
		players[socket.id] = state;
		// Sygnał broadcast aktualizujący liczbę graczy w klientach
		io.emit('update-players',players);
	})
  
  // Nasłuchiwanie rozłączania graczy i aktualizacja tabeli
  socket.on('disconnect',function(state){
    delete players[socket.id];
    io.emit('update-players',players);
  }) 
  
  // Nasłuchiwanie ruchu oraz informowanie o nim klientów
  socket.on('move-player',function(position_data){
    if(players[socket.id] == undefined) return; // Wykluczenie przypadków gdy klient jest wciąż połączony po restarcie serwera 
    players[socket.id].x = position_data.x;  
    players[socket.id].y = position_data.y; 
    players[socket.id].angle = position_data.angle; 
    io.emit('update-players',players);
  })
  
  // Nasłuchiwanie wystrzałów (shoot-ball) oraz dodawanie do tablicy
  socket.on('shoot-ball',function(data){
    if(players[socket.id] == undefined) return;
    var new_ball = data;
    data.owner_id = socket.id; // Dołączanie id właściciela do pocisku
    if(Math.abs(data.speed_x) > 20 || Math.abs(data.speed_y) > 20){
      console.log("Player",socket.id,"oszukuje!");
    } // Bat na cwaniaków hackujących naszą grę
    ball_array.push(new_ball);
  });
})

// Aktualizowanie pocisków ze stosowną szybkością (około 60 klatek na sekundę) 
function ServerGameLoop(){
  for(var i=0;i<ball_array.length;i++){
    var ball = ball_array[i];
    ball.x += ball.speed_x; 
    ball.y += ball.speed_y; 
    
    // Sprawdzanie czy pocisk uderza gracza
    for(var id in players){
      if(ball.owner_id != id){
        // i wykluczenie sytuacji, gdy jest to jego własny (np. przy wystrzale)
        var dx = players[id].x - ball.x; 
        var dy = players[id].y - ball.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if(dist < 70){
          io.emit('player-hit',id); // Broadcast, że gracz został uderzony
        }
      }
    }
    
    // Usuwanie pocisków spoza obszaru gry 
    if(ball.x < -10 || ball.x > 1000 || ball.y < -10 || ball.y > 1000){
        ball_array.splice(i,1);
        i--;
    }
        
  }
  // Broadcast tablicy z pozycjami pocisków
  io.emit("balls-update",ball_array);
}

setInterval(ServerGameLoop, 16); 
