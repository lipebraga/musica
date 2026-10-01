import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView,
} from 'react-native';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@faixas';

// Áudios locais ficam em assets/audio/. require() precisa de caminho fixo.
const FAIXAS_INICIAIS = [
  { id: '1', nome: 'Faixa 01', arquivo: require('./assets/audio/faixa1.mp3') },
  { id: '2', nome: 'Faixa 02', arquivo: require('./assets/audio/faixa2.mp3') },
  { id: '3', nome: 'Faixa 03', arquivo: require('./assets/audio/faixa3.mp3') },
  { id: '4', nome: 'Faixa 04', arquivo: require('./assets/audio/faixa4.mp3') },
  { id: '5', nome: 'Faixa 05', arquivo: require('./assets/audio/faixa5.mp3') },
];

// Como require() não pode ser salvo no AsyncStorage, persistimos só id + nome
// e remontamos o arquivo a partir de FAIXAS_INICIAIS.
const arquivoPorId = Object.fromEntries(FAIXAS_INICIAIS.map(f => [f.id, f.arquivo]));

const formatar = (ms) => {
  const total = Math.floor((ms || 0) / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
};

export default function App() {
  const [faixas, setFaixas] = useState([]);
  const [tocandoId, setTocandoId] = useState(null);
  const [posicao, setPosicao] = useState(0);
  const [duracao, setDuracao] = useState(0);
  const somRef = useRef(null);

  // Carrega os nomes salvos (ou usa os iniciais na primeira vez)
  useEffect(() => {
    (async () => {
      try {
        const salvo = await AsyncStorage.getItem(STORAGE_KEY);
        if (salvo) {
          setFaixas(JSON.parse(salvo));
        } else {
          const base = FAIXAS_INICIAIS.map(({ id, nome }) => ({ id, nome }));
          setFaixas(base);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(base));
        }
      } catch (e) {
        console.log('Erro ao carregar', e);
      }
    })();
  }, []);

  // Para e descarrega o áudio quando o componente sai da tela
  useEffect(() => {
    return () => {
      somRef.current?.unloadAsync();
    };
  }, []);

  const pararAtual = async () => {
    if (somRef.current) {
      await somRef.current.unloadAsync();
      somRef.current = null;
    }
    setTocandoId(null);
    setPosicao(0);
    setDuracao(0);
  };

  const tocar = async (faixa) => {
    if (tocandoId === faixa.id) {
      await pararAtual();
      return;
    }
    await pararAtual();
    const { sound } = await Audio.Sound.createAsync(
      arquivoPorId[faixa.id],
      { shouldPlay: true },
      (status) => {
        if (!status.isLoaded) return;
        setPosicao(status.positionMillis);
        setDuracao(status.durationMillis || 0);
        if (status.didJustFinish) pararAtual();
      }
    );
    somRef.current = sound;
    setTocandoId(faixa.id);
  };

  const excluir = async (id) => {
    if (tocandoId === id) await pararAtual();
    const novas = faixas.filter(f => f.id !== id);
    setFaixas(novas);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(novas));
  };

  const progresso = duracao > 0 ? posicao / duracao : 0;

  const renderItem = ({ item }) => {
    const ativo = tocandoId === item.id;
    return (
      <View style={styles.item}>
        <View style={styles.linha}>
          <TouchableOpacity onPress={() => tocar(item)} style={styles.botao}>
            <Text style={styles.icone}>{ativo ? '⏸' : '▶️'}</Text>
          </TouchableOpacity>
          <Text style={styles.nome}>{item.nome}</Text>
          <TouchableOpacity onPress={() => excluir(item.id)}>
            <Text style={styles.icone}>🗑️</Text>
          </TouchableOpacity>
        </View>
        {ativo && (
          <View style={styles.linha}>
            <View style={styles.barraFundo}>
              <View style={[styles.barra, { width: `${progresso * 100}%` }]} />
            </View>
            <Text style={styles.tempo}>
              {formatar(posicao)} / {formatar(duracao)}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.titulo}>Meu Player</Text>
      <FlatList
        data={faixas}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.vazio}>Nenhuma faixa.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 16, paddingTop: 48 },
  titulo: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  item: { backgroundColor: '#1e1e1e', borderRadius: 10, padding: 12, marginBottom: 10 },
  linha: { flexDirection: 'row', alignItems: 'center' },
  botao: { marginRight: 12 },
  icone: { fontSize: 22 },
  nome: { color: '#fff', fontSize: 16, flex: 1 },
  barraFundo: { flex: 1, height: 6, backgroundColor: '#444', borderRadius: 3, marginTop: 10 },
  barra: { height: 6, backgroundColor: '#1db954', borderRadius: 3 },
  tempo: { color: '#bbb', fontSize: 12, marginLeft: 8, marginTop: 10 },
  vazio: { color: '#888', textAlign: 'center', marginTop: 32 },
});