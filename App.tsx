import React from 'react';
import {
  StyleSheet,
  Text,
  Image,
  Button,
  TouchableOpacity,
  TouchableHighlight,
  Alert,
  SafeAreaView,
  Pressable,
} from 'react-native';
const App: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <Text>Welcome to AnyaAI!</Text>;{/* <Image */}
      {/*   source={{ */}
      {/*     uri: 'https://images.pexels.com/photos/28949655/pexels-photo-28949655.jpeg', */}
      {/*   }} */}
      {/*   style={{ height: 500, width: 400 }} */}
      {/* /> */}
      <Button title="Press Me"></Button>
      <TouchableOpacity
        style={{ backgroundColor: 'red' }}
        onPress={() => Alert.alert('Buttons is pressed')}
      >
        <Text>Button</Text>
      </TouchableOpacity>
      <TouchableHighlight style={{ backgroundColor: 'green' }}>
        <Text>Button</Text>
      </TouchableHighlight>
      <Pressable style={{ padding: 10, backgroundColor: 'yellow' }}>
        <Text>Pressable Button</Text>
      </Pressable>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'lightgreen',
  },
});
export default App;
