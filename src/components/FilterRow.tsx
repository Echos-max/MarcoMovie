
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Text,
} from 'react-native';

type FilterRowProps = {
    title: string;
    options: string[];
    selected: string;
    onSelect: (option: string) => void;
};

const FilterRow = ({
                       title,
                       options,
                       selected,
                       onSelect,
                   }: FilterRowProps) => {
    if (!options || options.length === 0) return null;

    return (
        <View style={styles.filterRowContainer}>
            <Text style={styles.rowTitle}>{title}</Text>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterScroll}
            >
                {options.map((option) => (
                    <TouchableOpacity
                        key={option}
                        style={[
                            styles.tag,
                            selected === option && styles.tagActive,
                        ]}
                        onPress={() => onSelect(option)}
                    >
                        <Text
                            style={[
                                styles.tagText,
                                selected === option && styles.tagTextActive,
                            ]}
                        >
                            {option}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
};

export default FilterRow;

const styles = StyleSheet.create({
    filterContainer: {
        paddingVertical: 5,
        backgroundColor: '#f8f9fa',
    },
    filterRowContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 6,
    },
    rowTitle: {
        width: 80,
        paddingLeft: 15,
        fontSize: 16,
        color: '#000000',
    },
    filterScroll: {
        flex: 1,
    },
    tag: {
        backgroundColor: '#e8e7ea',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
        marginRight: 8,
        borderColor: '#eee',
    },
    tagActive: {
        backgroundColor: '#1890ff',
        borderColor: '#91d5ff',
    },
    tagText: {
        fontSize: 16,
        color: '#333',
    },
    tagTextActive: {
        color: '#ffffff',
    },
});
