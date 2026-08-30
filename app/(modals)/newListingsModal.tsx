import React from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { BackButton, ListingCard, ScreenContainer } from '@/components';
import { colors, fontFamily, fontSize, spacingY } from '@/constants/theme';
import { listingsApi } from '@/api';
import { usePaginatedListings } from '@/hooks/usePaginatedListings';
import { useFavoriteToggle } from '@/hooks/useFavoriteToggle';
import { showWarningToast } from '@/lib/toast';

// FULL-SCREEN "SEE ALL" MODAL — Home's "Recently Posted" section, GET /listings/new
export default function NewListingsModal() {
  const { items, loading, loadingMore, refreshing, error, hasMore, loadMore, refresh } = usePaginatedListings(
    ({ page, limit }) => listingsApi.getNewListings({ page, limit })
  );
  const { favoriteIds, toggleFavorite } = useFavoriteToggle();

  function onPressListing() {
    // No listing detail screen yet — nothing to navigate to.
    showWarningToast('Coming soon', "Listing details aren't built yet.");
  }

  return (
    <ScreenContainer edges={['top', 'bottom']} background={colors.white} scroll={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Recently Posted</Text>
        <BackButton iconType="cancel" />
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ListingCard
            listing={item}
            onPress={onPressListing}
            showFavorite
            favorited={favoriteIds.has(item.id)}
            onToggleFavorite={() => toggleFavorite(item.id)}
          />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        onEndReachedThreshold={0.4}
        onEndReached={hasMore ? loadMore : undefined}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} style={styles.loading} />
          ) : (
            <Text style={styles.message}>{error ?? 'No listings yet.'}</Text>
          )
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={styles.footerLoading} /> : null}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacingY.xl,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
    color: colors.ink,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: spacingY.xl,
  },
  loading: {
    paddingVertical: spacingY['3xl'],
  },
  footerLoading: {
    paddingVertical: spacingY.lg,
  },
  message: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray400,
    paddingVertical: spacingY.xl,
    textAlign: 'center',
  },
});
