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
  useColorScheme,
  View,
} from 'react-native';
const App: React.FC = () => {
  const theme = useColorScheme();
  const isDarkMode = theme === 'dark';
  const backgroundColor = isDarkMode ? 'black' : 'white';
  const textColor = isDarkMode ? 'white' : 'black';
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: backgroundColor }]}
    >
      <Text style={{ color: textColor }}>Welcome to AnyaAI!</Text>;
      {/* <Image */}
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
      <View>
        <Text style={{ color: textColor }}>
          {' '}
          This is just for testing purpose.
        </Text>
      </View>
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
